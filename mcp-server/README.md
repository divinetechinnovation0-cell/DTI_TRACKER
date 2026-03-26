# DTI Tracker MCP Server

Lets Claude read and write data in your DTI Performance Tracker.

## Setup

### 1. Get your Supabase Service Role Key
Go to: Supabase Dashboard > Project Settings > API > service_role key

### 2. Add to Claude Code settings
Add this to your `.claude/settings.json` or global settings:

```json
{
  "mcpServers": {
    "dti-tracker": {
      "command": "node",
      "args": ["D:/DTI/dti-performance-tracker/mcp-server/index.js"],
      "env": {
        "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key-here"
      }
    }
  }
}
```

### 3. Available Tools

**Read (safe):**
- `get_team` — all active team members
- `get_clients` — all clients
- `get_work_logs` — work logs with date/member/client filters
- `get_attendance` — attendance records
- `get_expenses` — expense records
- `get_tasks` — tasks with filters
- `get_client_costs` — monthly cost breakdown per client with suggested pricing
- `get_team_utilization` — capacity utilization per member
- `who_hasnt_logged_today` — quick check who's missing

**Write (with safety):**
- `log_work` — log work hours for a member
- `mark_attendance` — mark attendance
- `create_task` — create and assign a task
- `send_ping` — send a notification to someone
- `record_expense` — record an expense

**Custom:**
- `query_data` — run any SELECT query for ad-hoc analysis
