import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://qepynaokicoopdxnokdv.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is required");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const server = new McpServer({
  name: "DTI Tracker",
  version: "1.0.0",
});

// ==================== READ TOOLS ====================

server.tool("get_team", "Get all active team members with roles and work info", {}, async () => {
  const { data, error } = await supabase
    .from("team_members")
    .select("id, name, email, role, primary_work, is_admin, is_active")
    .eq("is_active", true)
    .order("name");
  if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("get_clients", "Get all clients with status and services", {}, async () => {
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, status, services, contact_person, color")
    .order("name");
  if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool(
  "get_work_logs",
  "Get work logs with optional filters. Returns who worked on what, for which client, how many hours.",
  {
    date_from: z.string().optional().describe("Start date (YYYY-MM-DD). Defaults to start of current month."),
    date_to: z.string().optional().describe("End date (YYYY-MM-DD). Defaults to today."),
    member_name: z.string().optional().describe("Filter by team member name (partial match)"),
    client_name: z.string().optional().describe("Filter by client name (partial match)"),
  },
  async ({ date_from, date_to, member_name, client_name }) => {
    const today = new Date().toISOString().split("T")[0];
    const monthStart = today.slice(0, 7) + "-01";

    let query = supabase
      .from("work_logs")
      .select("date, hours, work_type, service_category, description, team_member:team_members(name), client:clients(name)")
      .gte("date", date_from || monthStart)
      .lte("date", date_to || today)
      .order("date", { ascending: false });

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };

    let filtered = data || [];
    if (member_name) {
      filtered = filtered.filter((r) => r.team_member?.name?.toLowerCase().includes(member_name.toLowerCase()));
    }
    if (client_name) {
      filtered = filtered.filter((r) => r.client?.name?.toLowerCase().includes(client_name.toLowerCase()));
    }

    const summary = {
      total_entries: filtered.length,
      total_hours: filtered.reduce((s, r) => s + Number(r.hours), 0),
      entries: filtered.slice(0, 50),
    };
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
  }
);

server.tool(
  "get_attendance",
  "Get attendance records. Shows who was present, absent, on leave.",
  {
    date_from: z.string().optional().describe("Start date (YYYY-MM-DD)"),
    date_to: z.string().optional().describe("End date (YYYY-MM-DD)"),
    member_name: z.string().optional().describe("Filter by member name"),
  },
  async ({ date_from, date_to, member_name }) => {
    const today = new Date().toISOString().split("T")[0];
    const monthStart = today.slice(0, 7) + "-01";

    const { data, error } = await supabase
      .from("attendance")
      .select("date, status, check_in_time, note, team_member:team_members(name)")
      .gte("date", date_from || monthStart)
      .lte("date", date_to || today)
      .order("date", { ascending: false });

    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };

    let filtered = data || [];
    if (member_name) {
      filtered = filtered.filter((r) => r.team_member?.name?.toLowerCase().includes(member_name.toLowerCase()));
    }
    return { content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }] };
  }
);

server.tool(
  "get_expenses",
  "Get expense records with optional filters",
  {
    date_from: z.string().optional().describe("Start date"),
    date_to: z.string().optional().describe("End date"),
    client_name: z.string().optional().describe("Filter by client"),
    category: z.string().optional().describe("Filter by category: ad_spend, tools, travel, freelance, salary, rent, other"),
  },
  async ({ date_from, date_to, client_name, category }) => {
    const today = new Date().toISOString().split("T")[0];
    const monthStart = today.slice(0, 7) + "-01";

    let query = supabase
      .from("expenses")
      .select("date, amount, category, cost_type, description, client:clients(name), recorder:team_members(name)")
      .gte("date", date_from || monthStart)
      .lte("date", date_to || today)
      .order("date", { ascending: false });

    if (category) query = query.eq("category", category);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };

    let filtered = data || [];
    if (client_name) {
      filtered = filtered.filter((r) => r.client?.name?.toLowerCase().includes(client_name.toLowerCase()));
    }

    const total = filtered.reduce((s, r) => s + Number(r.amount), 0);
    return {
      content: [{ type: "text", text: JSON.stringify({ total_amount: total, count: filtered.length, entries: filtered }, null, 2) }],
    };
  }
);

server.tool("get_tasks", "Get tasks with optional filters", {
  assigned_to_name: z.string().optional().describe("Filter by assignee name"),
  status: z.string().optional().describe("Filter by status: open or done"),
  weekly_goals_only: z.boolean().optional().describe("Only return weekly goals"),
}, async ({ assigned_to_name, status, weekly_goals_only }) => {
  let query = supabase
    .from("tasks")
    .select("title, description, status, priority, due_date, is_weekly_goal, week_start, completed_at, assignee:team_members!assigned_to(name), client:clients(name)")
    .order("due_date", { ascending: true });

  if (status) query = query.eq("status", status);
  if (weekly_goals_only) query = query.eq("is_weekly_goal", true);

  const { data, error } = await query;
  if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };

  let filtered = data || [];
  if (assigned_to_name) {
    filtered = filtered.filter((r) => r.assignee?.name?.toLowerCase().includes(assigned_to_name.toLowerCase()));
  }
  return { content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }] };
});

server.tool(
  "get_client_costs",
  "Get monthly cost breakdown per client — labor cost, direct expenses, total cost, suggested pricing",
  { month: z.string().optional().describe("Month in YYYY-MM-DD format (first of month). Defaults to current month.") },
  async ({ month }) => {
    const today = new Date().toISOString().split("T")[0];
    const targetMonth = month || today.slice(0, 7) + "-01";

    const { data, error } = await supabase.from("v_suggested_pricing").select("*").eq("month", targetMonth);
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool("get_team_utilization", "Get team capacity utilization for a month", {
  month: z.string().optional().describe("Month (YYYY-MM-DD, first of month)"),
}, async ({ month }) => {
  const today = new Date().toISOString().split("T")[0];
  const targetMonth = month || today.slice(0, 7) + "-01";

  const { data, error } = await supabase.from("v_team_capacity_utilization").select("*").eq("month", targetMonth);
  if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("who_hasnt_logged_today", "Check which team members haven't logged work or attendance today", {}, async () => {
  const today = new Date().toISOString().split("T")[0];

  const [{ data: members }, { data: todayLogs }, { data: todayAttendance }] = await Promise.all([
    supabase.from("team_members").select("id, name").eq("is_active", true),
    supabase.from("work_logs").select("team_member_id").eq("date", today),
    supabase.from("attendance").select("team_member_id, status").eq("date", today),
  ]);

  const loggedIds = new Set((todayLogs || []).map((l) => l.team_member_id));
  const attendanceMap = Object.fromEntries((todayAttendance || []).map((a) => [a.team_member_id, a.status]));

  const result = (members || []).map((m) => ({
    name: m.name,
    logged_work: loggedIds.has(m.id),
    attendance: attendanceMap[m.id] || "not marked",
  }));

  const notLogged = result.filter((r) => !r.logged_work).map((r) => r.name);
  const notMarked = result.filter((r) => r.attendance === "not marked").map((r) => r.name);

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        summary: `${result.length - notLogged.length}/${result.length} logged work, ${result.length - notMarked.length}/${result.length} marked attendance`,
        not_logged_work: notLogged,
        not_marked_attendance: notMarked,
        details: result,
      }, null, 2),
    }],
  };
});

server.tool(
  "query_data",
  "Run a custom read-only SQL query. Only SELECT statements allowed. Use for ad-hoc analysis.",
  { sql: z.string().describe("A SELECT SQL query. No INSERT/UPDATE/DELETE/DROP allowed.") },
  async ({ sql }) => {
    const forbidden = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)\b/i;
    if (forbidden.test(sql)) {
      return { content: [{ type: "text", text: "Error: Only SELECT queries are allowed." }] };
    }
    if (!sql.trim().toUpperCase().startsWith("SELECT")) {
      return { content: [{ type: "text", text: "Error: Query must start with SELECT." }] };
    }

    const { data, error } = await supabase.rpc("exec_sql", { query: sql }).select();
    // Fallback: use the REST API approach
    if (error) {
      // Try direct query via postgres
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
      });
      return { content: [{ type: "text", text: `Note: Custom SQL requires an exec_sql RPC function. Error: ${error.message}` }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ==================== WRITE TOOLS ====================

server.tool(
  "log_work",
  "Log work hours for a team member. Returns confirmation.",
  {
    member_name: z.string().describe("Team member name (exact or partial match)"),
    hours: z.number().min(0.5).max(16).describe("Hours worked (0.5 to 16)"),
    service: z.string().describe("Service: meta_ads, google_ads, seo, email_marketing, social_media, graphics, video_shooting, video_editing, web_dev, app_dev, client_management, research, admin, other"),
    work_type: z.string().default("serving").describe("Type: serving, acquisition, or internal"),
    client_name: z.string().optional().describe("Client name (partial match). Required for serving work."),
    description: z.string().optional().describe("Brief description"),
    date: z.string().optional().describe("Date (YYYY-MM-DD). Defaults to today."),
  },
  async ({ member_name, hours, service, work_type, client_name, description, date }) => {
    const today = new Date().toISOString().split("T")[0];

    // Find member
    const { data: members } = await supabase
      .from("team_members")
      .select("id, name")
      .ilike("name", `%${member_name}%`)
      .eq("is_active", true);

    if (!members || members.length === 0) {
      return { content: [{ type: "text", text: `No team member found matching "${member_name}"` }] };
    }
    if (members.length > 1) {
      return { content: [{ type: "text", text: `Multiple matches: ${members.map((m) => m.name).join(", ")}. Be more specific.` }] };
    }
    const member = members[0];

    // Find client if provided
    let clientId = null;
    if (client_name) {
      const { data: clients } = await supabase
        .from("clients")
        .select("id, name")
        .ilike("name", `%${client_name}%`)
        .eq("status", "active");

      if (!clients || clients.length === 0) {
        return { content: [{ type: "text", text: `No active client found matching "${client_name}"` }] };
      }
      clientId = clients[0].id;
    }

    const { error } = await supabase.from("work_logs").insert({
      team_member_id: member.id,
      client_id: clientId,
      date: date || today,
      hours,
      work_type,
      service_category: service,
      description: description || "",
    });

    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return {
      content: [{ type: "text", text: `Logged ${hours}h of ${service} for ${member.name}${clientId ? ` on ${client_name}` : ""} on ${date || today}` }],
    };
  }
);

server.tool(
  "mark_attendance",
  "Mark attendance for a team member",
  {
    member_name: z.string().describe("Team member name"),
    status: z.string().describe("Status: present, absent, half_day, or leave"),
    date: z.string().optional().describe("Date (YYYY-MM-DD). Defaults to today."),
  },
  async ({ member_name, status, date }) => {
    const today = new Date().toISOString().split("T")[0];

    const { data: members } = await supabase
      .from("team_members")
      .select("id, name")
      .ilike("name", `%${member_name}%`)
      .eq("is_active", true);

    if (!members || members.length === 0) {
      return { content: [{ type: "text", text: `No member found matching "${member_name}"` }] };
    }
    if (members.length > 1) {
      return { content: [{ type: "text", text: `Multiple matches: ${members.map((m) => m.name).join(", ")}` }] };
    }

    const member = members[0];
    const targetDate = date || today;

    // Upsert
    const { data: existing } = await supabase
      .from("attendance")
      .select("id")
      .eq("team_member_id", member.id)
      .eq("date", targetDate)
      .single();

    if (existing) {
      const { error } = await supabase
        .from("attendance")
        .update({ status, check_in_time: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    } else {
      const { error } = await supabase.from("attendance").insert({
        team_member_id: member.id,
        date: targetDate,
        status,
        check_in_time: new Date().toISOString(),
      });
      if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    }

    return { content: [{ type: "text", text: `Marked ${member.name} as ${status} on ${targetDate}` }] };
  }
);

server.tool(
  "create_task",
  "Create a task and assign it to a team member",
  {
    title: z.string().describe("Task title"),
    assigned_to_name: z.string().describe("Name of person to assign to"),
    due_date: z.string().optional().describe("Due date (YYYY-MM-DD)"),
    client_name: z.string().optional().describe("Associated client name"),
    priority: z.string().default("normal").describe("Priority: normal or urgent"),
    is_weekly_goal: z.boolean().default(false).describe("Is this a weekly goal?"),
    description: z.string().optional().describe("Task description"),
  },
  async ({ title, assigned_to_name, due_date, client_name, priority, is_weekly_goal, description }) => {
    // Find assignee
    const { data: members } = await supabase
      .from("team_members")
      .select("id, name")
      .ilike("name", `%${assigned_to_name}%`)
      .eq("is_active", true);

    if (!members || members.length === 0) {
      return { content: [{ type: "text", text: `No member found matching "${assigned_to_name}"` }] };
    }
    const assignee = members[0];

    // Find admin as assigner (Claude acts as admin)
    const { data: admins } = await supabase
      .from("team_members")
      .select("id")
      .eq("is_admin", true)
      .limit(1);

    const assignerId = admins?.[0]?.id || assignee.id;

    let clientId = null;
    if (client_name) {
      const { data: clients } = await supabase
        .from("clients")
        .select("id")
        .ilike("name", `%${client_name}%`)
        .limit(1);
      clientId = clients?.[0]?.id || null;
    }

    // Calculate week_start for weekly goals
    let weekStart = null;
    if (is_weekly_goal && due_date) {
      const d = new Date(due_date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      weekStart = new Date(d.setDate(diff)).toISOString().split("T")[0];
    }

    const { error } = await supabase.from("tasks").insert({
      title,
      description: description || "",
      assigned_to: assignee.id,
      assigned_by: assignerId,
      client_id: clientId,
      due_date: due_date || null,
      priority,
      is_weekly_goal,
      week_start: weekStart,
    });

    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: `Task "${title}" assigned to ${assignee.name}${due_date ? ` due ${due_date}` : ""}` }] };
  }
);

server.tool(
  "send_ping",
  "Send a notification/ping to a team member",
  {
    to_name: z.string().describe("Recipient name"),
    message: z.string().describe("Message to send"),
  },
  async ({ to_name, message }) => {
    const { data: members } = await supabase
      .from("team_members")
      .select("id, name")
      .ilike("name", `%${to_name}%`)
      .eq("is_active", true);

    if (!members || members.length === 0) {
      return { content: [{ type: "text", text: `No member found matching "${to_name}"` }] };
    }

    const { data: admins } = await supabase
      .from("team_members")
      .select("id")
      .eq("is_admin", true)
      .limit(1);

    const { error } = await supabase.from("notifications").insert({
      recipient_id: members[0].id,
      sender_id: admins?.[0]?.id || null,
      type: "ping",
      title: message,
      link: "/",
    });

    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: `Pinged ${members[0].name}: "${message}"` }] };
  }
);

server.tool(
  "record_expense",
  "Record an expense",
  {
    amount: z.number().min(1).describe("Amount in NPR"),
    category: z.string().describe("Category: ad_spend, tools, travel, freelance, salary, rent, other"),
    cost_type: z.string().describe("Type: serving, acquisition, overhead"),
    description: z.string().describe("Description of the expense"),
    client_name: z.string().optional().describe("Client name if applicable"),
    recorded_by_name: z.string().optional().describe("Who recorded this. Defaults to admin."),
    date: z.string().optional().describe("Date (YYYY-MM-DD). Defaults to today."),
  },
  async ({ amount, category, cost_type, description, client_name, recorded_by_name, date }) => {
    const today = new Date().toISOString().split("T")[0];

    // Find recorder
    let recorderId;
    if (recorded_by_name) {
      const { data } = await supabase
        .from("team_members")
        .select("id, name")
        .ilike("name", `%${recorded_by_name}%`)
        .limit(1);
      recorderId = data?.[0]?.id;
    }
    if (!recorderId) {
      const { data } = await supabase.from("team_members").select("id").eq("is_admin", true).limit(1);
      recorderId = data?.[0]?.id;
    }

    let clientId = null;
    if (client_name) {
      const { data } = await supabase.from("clients").select("id").ilike("name", `%${client_name}%`).limit(1);
      clientId = data?.[0]?.id || null;
    }

    const { error } = await supabase.from("expenses").insert({
      amount,
      category,
      cost_type,
      description,
      client_id: clientId,
      recorded_by: recorderId,
      date: date || today,
    });

    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: `Recorded expense: NPR ${amount} (${category}, ${cost_type}) — ${description}` }] };
  }
);

// ==================== START SERVER ====================

const transport = new StdioServerTransport();
await server.connect(transport);
