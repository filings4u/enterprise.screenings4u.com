"use strict";

window.S4UCommerce = (() => {
  const client = () => window.S4UAuth.getClient();

  async function listInvoices({ organizationId = null, status = null } = {}) {
    let q = client().from("invoices").select("*").order("created_at", { ascending: false });
    if (organizationId) q = q.eq("organization_id", organizationId);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function listProposals({ organizationId = null, status = null } = {}) {
    let q = client().from("proposals").select("*").order("created_at", { ascending: false });
    if (organizationId) q = q.eq("organization_id", organizationId);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function createInvoiceForOrganization(payload) {
    const { data, error } = await client().rpc("create_invoice_for_organization", payload);
    if (error) throw error;
    return data;
  }

  async function createProposalForOrganization(payload) {
    const { data, error } = await client().rpc("create_proposal_for_organization", payload);
    if (error) throw error;
    return data;
  }

  return { listInvoices, listProposals, createInvoiceForOrganization, createProposalForOrganization };
})();
