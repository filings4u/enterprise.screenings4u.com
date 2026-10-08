import { createClient } from "npm:@supabase/supabase-js@2";

const H={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
  "Access-Control-Allow-Methods":"POST,OPTIONS"
};
const J=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{...H,"Content-Type":"application/json","Cache-Control":"no-store"}});
const esc=(v:any)=>String(v??"").replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]||c));

async function requireTrainingStaff(req:Request){
  const url=Deno.env.get("SUPABASE_URL")||"";
  const anon=Deno.env.get("SUPABASE_ANON_KEY")||"";
  const svc=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if(!token)throw Object.assign(new Error("Authentication required."),{status:401});
  const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const db=createClient(url,svc,{auth:{persistSession:false,autoRefreshToken:false}});
  const u=await auth.auth.getUser(token);
  if(u.error||!u.data.user)throw Object.assign(new Error("Authentication required."),{status:401});
  const staff=await db.from("management_staff").select("status,is_super_admin").eq("user_id",u.data.user.id).maybeSingle();
  if(staff.error)throw staff.error;
  if(!staff.data||staff.data.status!=="active")throw Object.assign(new Error("Training management access required."),{status:403});
  if(!staff.data.is_super_admin){
    const pa=await db.from("management_staff_portal_access").select("id").eq("user_id",u.data.user.id).eq("portal_code","training").eq("active",true).maybeSingle();
    if(pa.error)throw pa.error;
    if(!pa.data)throw Object.assign(new Error("Training management access required."),{status:403});
  }
  return {db,user:u.data.user};
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:H});
  if(req.method!=="POST")return J({error:"Method not allowed."},405);
  try{
    const {db,user}=await requireTrainingStaff(req);
    const body=await req.json().catch(()=>({}));
    const orderId=String(body.order_id||"").trim();
    if(!orderId)return J({error:"Order is required."},400);

    const oq=await db.from("orders").select("*").eq("id",orderId).maybeSingle();
    if(oq.error)throw oq.error;
    const order=oq.data;
    if(!order)return J({error:"Order not found."},404);

    const iq=await db.from("order_items").select("*,services!inner(id,slug,name)").eq("order_id",orderId).eq("services.slug","specimen_collector_training_supplies");
    if(iq.error)throw iq.error;
    if(!(iq.data||[]).length)return J({error:"This is not a Training Supplies order."},403);
    if(String(order.fulfillment_status||"").toLowerCase()!=="completed")return J({error:"Mark the order shipped before sending the shipment notice."},409);
    const tracking=String(order.tracking_number||"").trim();
    if(!tracking)return J({error:"Tracking number is required before sending the shipment notice."},409);
    const email=String(order.customer_email||"").trim().toLowerCase();
    if(!email)return J({error:"Customer email is missing from this order."},409);

    const first=String(order.customer_first_name||"").trim();
    const name=[first,order.customer_last_name].filter(Boolean).join(" ")||"Customer";
    const orderNumber=String(order.order_number||order.id);
    const logo="https://training.screenings4u.com/images/logo-learning-center.png";
    const ordersUrl="https://training.screenings4u.com/lms-orders.html";
    const subject=`Your screenings4u Training Supplies order has shipped — ${orderNumber}`;
    const html=`<!doctype html><html><body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#17365f"><table role="presentation" width="100%"><tr><td align="center" style="padding:28px 14px"><table role="presentation" width="620" style="max-width:620px;background:#fff;border:1px solid #dbe4ef;border-radius:14px;overflow:hidden"><tr><td style="padding:24px 28px;border-bottom:1px solid #e7edf5"><img src="${logo}" alt="screenings4u Learning Center" style="display:block;max-width:260px;width:100%;height:auto"></td></tr><tr><td style="padding:28px"><div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#f05a00;margin-bottom:8px">Shipment Update</div><h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#153e75">Your training supplies have shipped</h1><p style="font-size:16px;line-height:1.65;margin:0 0 14px">Hello ${esc(name)},</p><p style="font-size:16px;line-height:1.65;margin:0 0 16px">Your screenings4u Learning Center order <strong>${esc(orderNumber)}</strong> has been shipped.</p><div style="background:#f4f7fb;border:1px solid #dbe4ef;border-radius:10px;padding:18px;margin:18px 0"><div style="font-size:12px;color:#6b7c93;text-transform:uppercase;font-weight:800;letter-spacing:.06em">Tracking Number</div><div style="font-size:20px;font-weight:800;color:#24467f;margin-top:5px;word-break:break-all">${esc(tracking)}</div></div><p style="margin:22px 0"><a href="${ordersUrl}" style="display:inline-block;background:#244f8d;color:#fff;text-decoration:none;border-radius:8px;padding:13px 20px;font-weight:700">View Your Order</a></p><p style="font-size:13px;line-height:1.6;color:#6b7c93;margin:22px 0 0">You can also sign in to your screenings4u Learning Center account and open Orders to view this tracking number.</p></td></tr></table></td></tr></table></body></html>`;

    const event:any={
      event_type:"training_shipment_notification",
      related_entity_type:"order",
      related_entity_id:order.id,
      recipient_user_id:order.user_id||null,
      recipient_name:name,
      recipient_email:email,
      subject,
      provider:"resend",
      status:"queued",
      created_by:user.id,
      metadata:{order_number:orderNumber,tracking_number:tracking,brand:"screenings4u_training",orders_url:ordersUrl},
      created_at:new Date().toISOString()
    };

    const key=Deno.env.get("RESEND_API_KEY")||"";
    if(!key){
      event.status="skipped";
      event.error_message="RESEND_API_KEY not configured";
      await db.from("training_email_events").insert(event);
      return J({error:"Shipment was saved, but email delivery is not configured."},500);
    }

    const rr=await fetch("https://api.resend.com/emails",{
      method:"POST",
      headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},
      body:JSON.stringify({
        from:Deno.env.get("SCREENINGS4U_FROM_EMAIL")||"screenings4u <notifications@screenings4u.com>",
        to:[email],
        subject,
        html
      })
    });
    const rb=await rr.json().catch(()=>({}));
    event.status=rr.ok?"sent":"failed";
    event.provider_message_id=rb?.id||null;
    event.error_message=rr.ok?null:(rb?.message||`HTTP ${rr.status}`);
    event.sent_at=rr.ok?new Date().toISOString():null;
    await db.from("training_email_events").insert(event);
    if(!rr.ok)return J({error:event.error_message||"Unable to send shipment email."},502);

    return J({ok:true,order_id:order.id,order_number:orderNumber,tracking_number:tracking,email_sent:true,provider_message_id:event.provider_message_id});
  }catch(e:any){
    console.error("send-training-shipment-notification",e);
    return J({error:e?.message||String(e)},e?.status||500);
  }
});
