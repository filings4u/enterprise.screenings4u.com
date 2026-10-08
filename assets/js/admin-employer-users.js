/* ============================================================
   screenings4u — ADMIN EMPLOYER USERS

   Employer portal user management.

   Tables:
   - user_role_assignments
   - user_profiles
   - employer_profiles
   ============================================================ */

(() => {

    "use strict";


    /* ========================================================
       STATE
       ======================================================== */

    let client = null;

    let employerUsers = [];

    let employers = [];


    const EMPLOYER_ROLES = [
        "employer_admin",
        "employer_hr",
        "employer_safety",
        "employer_billing"
    ];


    /* ========================================================
       INITIALIZATION
       ======================================================== */

    document.addEventListener(
        "DOMContentLoaded",
        initializeEmployerUsers
    );


    async function initializeEmployerUsers() {

        bindUi();

        client = getClient();

        if (!client) {

            showError(
                "Supabase client was not found."
            );

            return;
        }


        try {

            await requireAdmin();

            await loadPageData();

            await loadAdminProfile();

        } catch (error) {

            console.error(
                "Employer Users initialization failed:",
                error
            );

            showError(
                error.message ||
                "Unable to load employer users."
            );

        }

    }


    /* ========================================================
       SUPABASE CLIENT
       ======================================================== */

    function getClient() {

        try {

            if (
                typeof window.getScreenings4uSupabase ===
                "function"
            ) {

                return window.getScreenings4uSupabase();

            }


            if (window.screenings4uSupabase?.from) {

                return window.screenings4uSupabase;

            }


            if (window.supabaseClient?.from) {

                return window.supabaseClient;

            }

        } catch (error) {

            console.error(
                "Unable to obtain Supabase client:",
                error
            );

        }


        return null;

    }


    /* ========================================================
       ADMIN AUTHORIZATION
       ======================================================== */

    async function requireAdmin() {

        if (!window.S4UAuth?.getSession) {

            return;

        }


        const session =
            await window.S4UAuth.getSession();


        if (!session?.user) {

            window.location.replace(
                "admin-login.html"
            );

            throw new Error(
                "Authentication required."
            );

        }


        const { data, error } =
            await client
                .from("user_role_assignments")
                .select("role")
                .eq(
                    "user_id",
                    session.user.id
                );


        if (error) {

            throw error;

        }


        const allowed =
            (data || []).some(row => {

                const role =
                    String(
                        row.role || ""
                    ).toLowerCase();


                return (
                    role === "admin" ||
                    role === "super_admin"
                );

            });


        if (!allowed) {

            await client.auth.signOut();

            window.location.replace(
                "admin-login.html"
            );


            throw new Error(
                "This account does not have access to the admin portal."
            );

        }

    }


    /* ========================================================
       UI EVENTS
       ======================================================== */

    function bindUi() {

        document
            .getElementById("employerUserSearch")
            ?.addEventListener(
                "input",
                renderEmployerUsers
            );


        document
            .getElementById("employerUserEmployerFilter")
            ?.addEventListener(
                "change",
                renderEmployerUsers
            );


        document
            .getElementById("employerUserRoleFilter")
            ?.addEventListener(
                "change",
                renderEmployerUsers
            );


        document
            .getElementById("employerUserStatusFilter")
            ?.addEventListener(
                "change",
                renderEmployerUsers
            );


        document
            .getElementById("refreshEmployerUsersButton")
            ?.addEventListener(
                "click",
                loadPageData
            );


        document
            .getElementById("addEmployerUserButton")
            ?.addEventListener(
                "click",
                openAddEmployerUser
            );


        document
            .getElementById("employerUsersTableBody")
            ?.addEventListener(
                "click",
                handleTableClick
            );


        bindAdminUserMenu();

    }


    /* ========================================================
       LOAD PAGE DATA
       ======================================================== */

    async function loadPageData() {

        setLoading(true);


        try {

            await Promise.all([
                loadEmployers(),
                loadEmployerUsers()
            ]);


            populateEmployerFilter();

            updateMetrics();

            renderEmployerUsers();

        } finally {

            setLoading(false);

        }

    }


    /* ========================================================
       LOAD EMPLOYERS
       ======================================================== */

    async function loadEmployers() {

        const { data, error } =
            await client
                .from("employer_profiles")
                .select(
                    "id, employer_name, status"
                )
                .order(
                    "employer_name",
                    {
                        ascending: true
                    }
                );


        if (error) {

            throw error;

        }


        employers =
            Array.isArray(data)
                ? data
                : [];

    }


    /* ========================================================
       LOAD EMPLOYER USERS
       ======================================================== */

    async function loadEmployerUsers() {

        /*
         * user_role_assignments has a foreign-key relationship to
         * employer_profiles, but not to user_profiles.
         *
         * Load assignments with the valid employer relationship first,
         * then load matching user profiles separately and merge them
         * by user_role_assignments.user_id === user_profiles.id.
         */

        const {
            data: assignmentData,
            error: assignmentError
        } =
            await client
                .from("user_role_assignments")
                .select(`
                    id,
                    user_id,
                    role,
                    employer_id,
                    created_at,
                    employer_profiles (
                        id,
                        employer_name
                    )
                `)
                .in(
                    "role",
                    EMPLOYER_ROLES
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (assignmentError) {

            throw assignmentError;

        }


        const assignments =
            Array.isArray(assignmentData)
                ? assignmentData
                : [];


        const userIds =
            [
                ...new Set(
                    assignments
                        .map(row => row.user_id)
                        .filter(Boolean)
                )
            ];


        let profiles = [];


        if (userIds.length) {

            const {
                data: profileData,
                error: profileError
            } =
                await client
                    .from("user_profiles")
                    .select(`
                        id,
                        first_name,
                        last_name,
                        display_name,
                        email,
                        phone,
                        is_active,
                        last_seen_at
                    `)
                    .in(
                        "id",
                        userIds
                    );


            if (profileError) {

                throw profileError;

            }


            profiles =
                Array.isArray(profileData)
                    ? profileData
                    : [];

        }


        const profileMap =
            new Map(
                profiles.map(profile => [
                    profile.id,
                    profile
                ])
            );


        employerUsers =
            assignments.map(row =>
                normalizeEmployerUser({
                    ...row,
                    user_profiles:
                        profileMap.get(
                            row.user_id
                        ) || null
                })
            );

    }


    /* ========================================================
       NORMALIZE USER
       ======================================================== */

    function normalizeEmployerUser(row) {

        const profile =
            Array.isArray(row.user_profiles)
                ? row.user_profiles[0]
                : row.user_profiles;


        const employer =
            Array.isArray(row.employer_profiles)
                ? row.employer_profiles[0]
                : row.employer_profiles;


        return {

            assignmentId:
                row.id,

            userId:
                row.user_id,

            role:
                String(
                    row.role || ""
                ).toLowerCase(),

            employerId:
                row.employer_id,

            createdAt:
                row.created_at,

            firstName:
                profile?.first_name || "",

            lastName:
                profile?.last_name || "",

            displayName:
                profile?.display_name || "",

            email:
                profile?.email || "",

            phone:
                profile?.phone || "",

            isActive:
                Boolean(
                    profile?.is_active
                ),

            lastSeenAt:
                profile?.last_seen_at || null,

            employerName:
                employer?.employer_name ||
                "Unknown Employer"

        };

    }


    /* ========================================================
       EMPLOYER FILTER
       ======================================================== */

    function populateEmployerFilter() {

        const select =
            document.getElementById(
                "employerUserEmployerFilter"
            );


        if (!select) {

            return;

        }


        const currentValue =
            select.value;


        select.innerHTML =
            `<option value="all">
                All Employers
            </option>`;


        employers.forEach(employer => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                employer.id;


            option.textContent =
                employer.employer_name ||
                "Unnamed Employer";


            select.appendChild(
                option
            );

        });


        if (
            currentValue === "all" ||
            employers.some(
                employer =>
                    employer.id ===
                    currentValue
            )
        ) {

            select.value =
                currentValue;

        }

    }


    /* ========================================================
       METRICS
       ======================================================== */

    function updateMetrics() {

        const total =
            employerUsers.length;


        const active =
            employerUsers.filter(
                user =>
                    user.isActive
            ).length;


        const admins =
            employerUsers.filter(
                user =>
                    user.role ===
                    "employer_admin"
            ).length;


        const staff =
            total - admins;


        setMetric(
            "total",
            total
        );


        setMetric(
            "active",
            active
        );


        setMetric(
            "admins",
            admins
        );


        setMetric(
            "staff",
            staff
        );

    }


    function setMetric(
        name,
        value
    ) {

        const target =
            document.querySelector(
                `[data-employer-user-metric="${name}"]`
            );


        if (!target) {

            return;

        }


        target.textContent =
            Number(
                value || 0
            ).toLocaleString();

    }


    /* ========================================================
       FILTER USERS
       ======================================================== */

    function getFilteredEmployerUsers() {

        const search =
            String(
                document
                    .getElementById(
                        "employerUserSearch"
                    )
                    ?.value || ""
            )
                .trim()
                .toLowerCase();


        const employerId =
            document
                .getElementById(
                    "employerUserEmployerFilter"
                )
                ?.value ||
            "all";


        const role =
            document
                .getElementById(
                    "employerUserRoleFilter"
                )
                ?.value ||
            "all";


        const status =
            document
                .getElementById(
                    "employerUserStatusFilter"
                )
                ?.value ||
            "all";


        return employerUsers.filter(user => {

            const name =
                getUserName(user);


            const haystack = [

                name,

                user.firstName,

                user.lastName,

                user.email,

                user.phone,

                user.employerName,

                user.role

            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();


            const matchesSearch =
                !search ||
                haystack.includes(search);


            const matchesEmployer =
                employerId === "all" ||
                user.employerId === employerId;


            const matchesRole =
                role === "all" ||
                user.role === role;


            const userStatus =
                user.isActive
                    ? "active"
                    : "inactive";


            const matchesStatus =
                status === "all" ||
                userStatus === status;


            return (
                matchesSearch &&
                matchesEmployer &&
                matchesRole &&
                matchesStatus
            );

        });

    }


    /* ========================================================
       RENDER TABLE
       ======================================================== */

    function renderEmployerUsers() {

        const body =
            document.getElementById(
                "employerUsersTableBody"
            );


        if (!body) {

            return;

        }


        const users =
            getFilteredEmployerUsers();


        const count =
            document.getElementById(
                "employerUsersResultsCount"
            );


        if (count) {

            count.textContent =
                `${users.length} employer user${
                    users.length === 1
                        ? ""
                        : "s"
                }`;

        }


        if (!users.length) {

            body.innerHTML = `
                <tr>
                    <td
                        colspan="7"
                        class="employer-users-empty"
                    >
                        No employer users found.
                    </td>
                </tr>
            `;

            return;

        }


        body.innerHTML =
            users
                .map(user => {

                    const status =
                        user.isActive
                            ? "active"
                            : "inactive";


                    return `
                        <tr>

                            <td>
                                <strong>
                                    ${escapeHtml(
                                        getUserName(user)
                                    )}
                                </strong>

                                <small>
                                    ${escapeHtml(
                                        user.email ||
                                        "No email"
                                    )}
                                </small>
                            </td>


                            <td>
                                <strong>
                                    ${escapeHtml(
                                        user.employerName
                                    )}
                                </strong>
                            </td>


                            <td>
                                <span class="employer-user-role">
                                    ${escapeHtml(
                                        formatRole(
                                            user.role
                                        )
                                    )}
                                </span>
                            </td>


                            <td>
                                ${escapeHtml(
                                    user.phone ||
                                    "—"
                                )}
                            </td>


                            <td>
                                <span
                                    class="employer-user-status ${status}"
                                >
                                    ${status}
                                </span>
                            </td>


                            <td>
                                ${escapeHtml(
                                    formatLastSeen(
                                        user.lastSeenAt
                                    )
                                )}
                            </td>


                            <td>
                                <button
                                    type="button"
                                    class="employer-users-action-button"
                                    data-edit-employer-user="${escapeHtml(
                                        user.assignmentId
                                    )}"
                                >
                                    Edit
                                </button>
                            </td>

                        </tr>
                    `;

                })
                .join("");

    }


    /* ========================================================
       TABLE ACTIONS
       ======================================================== */

    function handleTableClick(event) {

        const editButton =
            event.target.closest(
                "[data-edit-employer-user]"
            );


        if (!editButton) {

            return;

        }


        const assignmentId =
            editButton.dataset
                .editEmployerUser;


        openEditEmployerUser(
            assignmentId
        );

    }


    /* ========================================================
       ADD EMPLOYER USER
       ======================================================== */

    function openAddEmployerUser() {

        if (
            !window.S4UUI?.formModal
        ) {

            window.S4UUI?.toast(
                "UI modal system is not loaded.",
                "error"
            );

            return;

        }


        window.S4UUI.formModal({

            title:
                "Add Employer User",

            message:
                "Create a user profile and assign employer portal access.",

            fields:
                getEmployerUserFields(),

            confirmText:
                "Create User",


            onSubmit:
                async values => {

                    await createEmployerUser(
                        values
                    );

                }

        });

    }


    /* ========================================================
       CREATE EMPLOYER USER

       IMPORTANT:
       The browser cannot safely create a new auth.users
       account with an admin API.

       This creates the application profile and role
       assignment for an existing user profile.

       Full account invitation/auth creation should later
       be handled through account_invitations or an
       Edge Function.
       ======================================================== */

    async function createEmployerUser(
        values
    ) {

        const email =
            String(
                values.email || ""
            )
                .trim()
                .toLowerCase();


        if (!email) {

            throw new Error(
                "Email is required."
            );

        }


        const {
            data: existingProfile,
            error: profileLookupError
        } =
            await client
                .from("user_profiles")
                .select(`
                    id,
                    email
                `)
                .eq(
                    "email",
                    email
                )
                .maybeSingle();


        if (
            profileLookupError
        ) {

            throw profileLookupError;

        }


        if (
            !existingProfile?.id
        ) {

            throw new Error(
                "No existing account was found for this email. Create or invite the account first, then assign its employer role."
            );

        }


        const employerId =
            values.employer_id;


        const role =
            values.role;


        if (
            !employerId
        ) {

            throw new Error(
                "Select an employer."
            );

        }


        if (
            !EMPLOYER_ROLES.includes(
                role
            )
        ) {

            throw new Error(
                "Select a valid employer role."
            );

        }


        const {
            data: existingAssignment,
            error: assignmentLookupError
        } =
            await client
                .from("user_role_assignments")
                .select("id")
                .eq(
                    "user_id",
                    existingProfile.id
                )
                .eq(
                    "employer_id",
                    employerId
                )
                .maybeSingle();


        if (
            assignmentLookupError
        ) {

            throw assignmentLookupError;

        }


        if (
            existingAssignment
        ) {

            throw new Error(
                "This user already has an assignment for the selected employer."
            );

        }


        const {
            error: insertError
        } =
            await client
                .from("user_role_assignments")
                .insert({

                    user_id:
                        existingProfile.id,

                    employer_id:
                        employerId,

                    role:
                        role

                });


        if (
            insertError
        ) {

            throw insertError;

        }


        window.S4UUI?.toast(
            "Employer user access assigned.",
            "success"
        );


        await loadPageData();

    }


    /* ========================================================
       EDIT EMPLOYER USER
       ======================================================== */

    function openEditEmployerUser(
        assignmentId
    ) {

        const user =
            employerUsers.find(
                item =>
                    item.assignmentId ===
                    assignmentId
            );


        if (
            !user ||
            !window.S4UUI?.formModal
        ) {

            return;

        }


        window.S4UUI.formModal({

            title:
                "Edit Employer User",

            message:
                "Update employer access and user profile information.",

            fields:
                getEmployerUserFields(
                    user,
                    true
                ),

            confirmText:
                "Save Changes",


            onSubmit:
                async values => {

                    await updateEmployerUser(
                        user,
                        values
                    );

                }

        });

    }


    /* ========================================================
       UPDATE EMPLOYER USER
       ======================================================== */

    async function updateEmployerUser(
        user,
        values
    ) {

        const profilePayload = {

            first_name:
                cleanValue(
                    values.first_name
                ),

            last_name:
                cleanValue(
                    values.last_name
                ),

            display_name:
                cleanValue(
                    values.display_name
                ),

            phone:
                cleanValue(
                    values.phone
                ),

            is_active:
                String(
                    values.is_active
                ) === "true"

        };


        const {
            error: profileError
        } =
            await client
                .from("user_profiles")
                .update(
                    profilePayload
                )
                .eq(
                    "id",
                    user.userId
                );


        if (
            profileError
        ) {

            throw profileError;

        }


        const assignmentPayload = {

            employer_id:
                values.employer_id,

            role:
                values.role

        };


        const {
            error: assignmentError
        } =
            await client
                .from("user_role_assignments")
                .update(
                    assignmentPayload
                )
                .eq(
                    "id",
                    user.assignmentId
                );


        if (
            assignmentError
        ) {

            throw assignmentError;

        }


        window.S4UUI?.toast(
            "Employer user updated.",
            "success"
        );


        await loadPageData();

    }


    /* ========================================================
       FORM FIELDS
       ======================================================== */

    function getEmployerUserFields(
        user = null,
        editing = false
    ) {

        const employerOptions =
            employers.map(
                employer => ({

                    value:
                        employer.id,

                    label:
                        employer.employer_name ||
                        "Unnamed Employer"

                })
            );


        const roleOptions = [

            {
                value:
                    "employer_admin",

                label:
                    "Employer Administrator"
            },

            {
                value:
                    "employer_hr",

                label:
                    "Human Resources"
            },

            {
                value:
                    "employer_safety",

                label:
                    "Safety"
            },

            {
                value:
                    "employer_billing",

                label:
                    "Billing"
            }

        ];


        const fields = [];


        if (!editing) {

            fields.push({

                name:
                    "email",

                label:
                    "Existing User Email",

                type:
                    "email",

                value:
                    "",

                required:
                    true

            });

        }


        if (editing) {

            fields.push(

                {
                    name:
                        "first_name",

                    label:
                        "First Name",

                    value:
                        user.firstName || ""
                },

                {
                    name:
                        "last_name",

                    label:
                        "Last Name",

                    value:
                        user.lastName || ""
                },

                {
                    name:
                        "display_name",

                    label:
                        "Display Name",

                    value:
                        user.displayName || ""
                },

                {
                    name:
                        "phone",

                    label:
                        "Phone",

                    value:
                        user.phone || ""
                }

            );

        }


        fields.push(

            {
                name:
                    "employer_id",

                label:
                    "Employer",

                type:
                    "select",

                value:
                    user?.employerId || "",

                options:
                    employerOptions
            },


            {
                name:
                    "role",

                label:
                    "Portal Role",

                type:
                    "select",

                value:
                    user?.role ||
                    "employer_admin",

                options:
                    roleOptions
            }

        );


        if (editing) {

            fields.push({

                name:
                    "is_active",

                label:
                    "Account Status",

                type:
                    "select",

                value:
                    user.isActive
                        ? "true"
                        : "false",

                options: [

                    {
                        value:
                            "true",

                        label:
                            "Active"
                    },

                    {
                        value:
                            "false",

                        label:
                            "Inactive"
                    }

                ]

            });

        }


        return fields;

    }


    /* ========================================================
       USER NAME
       ======================================================== */

    function getUserName(user) {

        if (
            user.displayName
        ) {

            return user.displayName;

        }


        const fullName =
            [
                user.firstName,
                user.lastName
            ]
                .filter(Boolean)
                .join(" ")
                .trim();


        if (
            fullName
        ) {

            return fullName;

        }


        return "Unnamed User";

    }


    /* ========================================================
       ROLE LABEL
       ======================================================== */

    function formatRole(role) {

        const labels = {

            employer_admin:
                "Employer Administrator",

            employer_hr:
                "Human Resources",

            employer_safety:
                "Safety",

            employer_billing:
                "Billing"

        };


        return (
            labels[role] ||
            role ||
            "Unknown"
        );

    }


    /* ========================================================
       LAST SEEN
       ======================================================== */

    function formatLastSeen(value) {

        if (!value) {

            return "Never";

        }


        const date =
            new Date(value);


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return "—";

        }


        const seconds =
            Math.max(
                0,
                Math.floor(
                    (
                        Date.now() -
                        date.getTime()
                    ) / 1000
                )
            );


        if (seconds < 60) {

            return "Now";

        }


        const minutes =
            Math.floor(
                seconds / 60
            );


        if (minutes < 60) {

            return `${minutes}m ago`;

        }


        const hours =
            Math.floor(
                minutes / 60
            );


        if (hours < 24) {

            return `${hours}h ago`;

        }


        const days =
            Math.floor(
                hours / 24
            );


        if (days < 7) {

            return `${days}d ago`;

        }


        return date.toLocaleDateString();

    }


    /* ========================================================
       ADMIN PROFILE
       ======================================================== */

    async function loadAdminProfile() {

        if (
            !window.S4UAuth?.getSession
        ) {

            return;

        }


        try {

            const session =
                await window.S4UAuth.getSession();


            if (
                !session?.user
            ) {

                return;

            }


            const {
                data,
                error
            } =
                await client
                    .from("user_profiles")
                    .select(`
                        first_name,
                        last_name,
                        display_name
                    `)
                    .eq(
                        "id",
                        session.user.id
                    )
                    .maybeSingle();


            if (error) {

                console.warn(
                    error
                );

                return;

            }


            const name =
                data?.display_name ||
                [
                    data?.first_name,
                    data?.last_name
                ]
                    .filter(Boolean)
                    .join(" ") ||
                "Administrator";


            const userName =
                document.getElementById(
                    "adminUserName"
                );


            const menuName =
                document.getElementById(
                    "adminUserMenuName"
                );


            if (userName) {

                userName.textContent =
                    name;

            }


            if (menuName) {

                menuName.textContent =
                    name;

            }

        } catch (error) {

            console.warn(
                "Unable to load admin profile:",
                error
            );

        }

    }


    /* ========================================================
       ADMIN USER MENU
       ======================================================== */

    function bindAdminUserMenu() {

        const toggle =
            document.querySelector(
                "[data-admin-user-menu-toggle]"
            );


        const menu =
            document.querySelector(
                "[data-admin-user-menu]"
            );


        if (
            toggle &&
            menu
        ) {

            toggle.addEventListener(
                "click",
                event => {

                    event.stopPropagation();


                    const isOpen =
                        menu.classList.toggle(
                            "show"
                        );


                    toggle.setAttribute(
                        "aria-expanded",
                        String(isOpen)
                    );

                }
            );


            document.addEventListener(
                "click",
                event => {

                    if (
                        !event.target.closest(
                            ".admin-user-dropdown"
                        )
                    ) {

                        menu.classList.remove(
                            "show"
                        );


                        toggle.setAttribute(
                            "aria-expanded",
                            "false"
                        );

                    }

                }
            );

        }


        document
            .querySelector(
                "[data-admin-logout]"
            )
            ?.addEventListener(
                "click",
                signOut
            );

    }


    /* ========================================================
       SIGN OUT
       ======================================================== */

    async function signOut() {

        try {

            if (
                window.S4UAuth?.signOut
            ) {

                await window.S4UAuth.signOut(
                    "admin-login.html"
                );

                return;

            }


            await client.auth.signOut();


            window.location.replace(
                "admin-login.html"
            );

        } catch (error) {

            console.error(
                "Sign out failed:",
                error
            );

        }

    }


    /* ========================================================
       LOADING
       ======================================================== */

    function setLoading(loading) {

        const button =
            document.getElementById(
                "refreshEmployerUsersButton"
            );


        if (button) {

            button.disabled =
                loading;


            button.textContent =
                loading
                    ? "Loading..."
                    : "Refresh";

        }

    }


    /* ========================================================
       ERROR
       ======================================================== */

    function showError(message) {

        const body =
            document.getElementById(
                "employerUsersTableBody"
            );


        if (body) {

            body.innerHTML = `
                <tr>
                    <td
                        colspan="7"
                        class="employer-users-empty"
                    >
                        ${escapeHtml(message)}
                    </td>
                </tr>
            `;

        }


        window.S4UUI?.toast(
            message,
            "error"
        );

    }


    /* ========================================================
       UTILITIES
       ======================================================== */

    function cleanValue(value) {

        if (
            typeof value === "string"
        ) {

            const cleaned =
                value.trim();


            return cleaned || null;

        }


        return value ?? null;

    }


    function escapeHtml(value) {

        return String(
            value ?? ""
        )
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );

    }


})();