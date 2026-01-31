-- Seed Data for Industrious Flight School
-- Run this in the Supabase SQL Editor after running migrations
-- Note: User profiles are created via Google OAuth signup, not seeded

-- ============================================
-- TRAINING MODULES
-- ============================================

INSERT INTO training_modules (id, title, description, type, duration, link, host, sort_order) VALUES
-- Week 1 Onboarding Modules (MXM Track)
('w1-1', 'IN PERSON OFFSITE TRAINING', 'All week: Immersion in Industrious culture and service standards.', 'LIVE_CALL', '5 Days', 'https://calendar.google.com', 'National Training Team', 1),
('w1-2', 'Intro to Training Path & Workbook', 'Review the Guide to Service and your training roadmap.', 'WORKBOOK', '1 hour', NULL, NULL, 2),
('w1-3', 'Systems Access Setup', 'Ensure you have access to Slack, Workday, Salesforce.', 'MANAGER_LED', '30 mins', NULL, NULL, 3),
('w1-4', 'Day to Day Ops Overview', 'Introduction to daily checklists and rhythm of the unit.', 'WORKBOOK', '2 hours', NULL, NULL, 4),
('w1-5', 'OKRs and Job Responsibilities', 'Deep dive into your Q1 Objectives and Key Results.', 'WORKBOOK', '1 hour', NULL, NULL, 5),

-- Generic Training Modules
('tm-1', 'Industrious Culture Workbook', 'Learn about our core values and mission.', 'WORKBOOK', '2 hours', NULL, NULL, 10),
('tm-2', 'Operations Systems Training', 'Deep dive into our internal tools.', 'VIDEO', '45 mins', NULL, NULL, 11),

-- Additional Training Modules (Week 2)
('w2-1', 'Member Engagement Best Practices', 'How to build meaningful connections with members.', 'LESSONLY', '45 mins', NULL, NULL, 20),
('w2-2', 'Facilities Walkthrough', 'Understanding building systems and maintenance protocols.', 'SHADOW', '2 hours', NULL, NULL, 21),
('w2-3', 'Service Recovery Training', 'How to handle complaints and turn detractors into promoters.', 'MANAGER_LED', '1 hour', NULL, NULL, 22),
('w2-4', 'Workbook: The Five Service Steps', 'Reflect on how to apply Universal Service Steps daily.', 'WORKBOOK', '30 mins', NULL, NULL, 23),

-- Week 3+ Modules
('w3-1', 'Sales Support Overview', 'Understanding the tour process and lead handoff.', 'LESSONLY', '1 hour', NULL, NULL, 30),
('w3-2', 'Event Planning & Execution', 'How to plan and execute member events.', 'PERFORM', '3 hours', NULL, NULL, 31),
('w3-3', 'BAU: Daily Operations Checklist', 'Practice running the daily checklist independently.', 'BAU', '2 hours', NULL, NULL, 32)

ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  duration = EXCLUDED.duration,
  link = EXCLUDED.link,
  host = EXCLUDED.host,
  sort_order = EXCLUDED.sort_order;

-- ============================================
-- OKRS (Objectives)
-- ============================================

INSERT INTO okrs (id, title, role_type) VALUES
-- MXM OKRs
('okr-mxm-1', 'Deliver an experience that welcomes, empowers, and delights our members and guests so they return time and again.', 'MXM'),
('okr-mxm-2', 'Build and maintain a welcoming, clean, and functional workspace environment.', 'MXM'),

-- GM OKRs
('okr-gm-1', 'Own the financial health and sustainability of my business from top to bottom.', 'GM'),
('okr-gm-2', 'Lead, develop, and retain a high-performing team.', 'GM'),

-- Universal OKRs (all roles)
('okr-all-1', 'Embody Industrious values in every interaction.', NULL)

ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  role_type = EXCLUDED.role_type;

-- ============================================
-- KEY RESULTS
-- ============================================

INSERT INTO key_results (id, okr_id, description, target, sort_order) VALUES
-- MXM OKR 1 Key Results
('kr-mxm-1-1', 'okr-mxm-1', 'Maintain a rolling 90 day NPS score at or above 70', '70+', 1),
('kr-mxm-1-2', 'okr-mxm-1', '90% of CX Dashboard completion', '90%', 2),
('kr-mxm-1-3', 'okr-mxm-1', 'Quarterly Mx Review score is at or above 90%', '90%', 3),

-- MXM OKR 2 Key Results
('kr-mxm-2-1', 'okr-mxm-2', 'Complete daily facility walkthroughs with zero missed items', '100%', 1),
('kr-mxm-2-2', 'okr-mxm-2', 'Respond to maintenance tickets within 24 hours', '<24h', 2),

-- GM OKR 1 Key Results
('kr-gm-1-1', 'okr-gm-1', 'Ensuring that the Quarterly Inc MCV Targets are achieved', 'On Target', 1),
('kr-gm-1-2', 'okr-gm-1', 'Deliver on Area EBITDA contribution by EOY', 'On Target', 2),

-- GM OKR 2 Key Results
('kr-gm-2-1', 'okr-gm-2', 'Maintain team retention rate above 85%', '85%', 1),
('kr-gm-2-2', 'okr-gm-2', 'Complete quarterly 1:1s with all direct reports', '100%', 2),

-- Universal OKR Key Results
('kr-all-1-1', 'okr-all-1', 'Practice the 5 Universal Service Steps daily', 'Daily', 1),
('kr-all-1-2', 'okr-all-1', 'Receive positive feedback on culture embodiment in quarterly review', 'Positive', 2)

ON CONFLICT (id) DO UPDATE SET
  okr_id = EXCLUDED.okr_id,
  description = EXCLUDED.description,
  target = EXCLUDED.target,
  sort_order = EXCLUDED.sort_order;

-- ============================================
-- MANAGER TASK TEMPLATES
-- ============================================

INSERT INTO manager_task_templates (id, title, description, due_date_offset, time_estimate, sort_order) VALUES
-- Pre-boarding tasks (negative offset = before start date)
('mt-1', 'Submit Zendesk Onboarding Ticket', 'Triggers critical processes (Workday, G-Suite, Slack, Zoom, etc.).', -7, '<5 mins', 1),
('mt-2', 'Order Welcome Swag Bag', 'Includes flair pen, sticker, notebook, baseball cap.', -7, '<5 mins', 2),

-- Day 0/1 tasks
('mt-3', 'Update Admin Portal Location Page', 'Update "Location Managers" section. Wait until they log into Salesforce first.', 1, '5 mins', 3),
('mt-4', 'Added to Distro Lists', 'Ensure they are on local and regional Google Groups/Slack channels.', 1, '5 mins', 4),
('mt-5', 'Upload Member Portal Photo', 'Instruct hire to upload profile photo for the website.', 0, '5 mins', 5),
('mt-6', 'Training Schedule & Onboarding Toolkit', 'Duplicate template, customize, and share standard Ops Onboarding Roadmap.', 0, '60 mins', 6),
('mt-8', 'Send Team Call Invites', 'Manually add to recurring calls (NAOPs Call, All Hands, etc.).', 0, '5 mins', 7),

-- Week 1 tasks
('mt-7', 'Growth Ops ZenDesk Ticket', 'Ticket Type: Calendly - Tour Member Availability Change (MxMs Only).', 7, '<5 mins', 8),
('mt-9', 'Complete Systems Checklist', 'Use the Systems Cheat Sheet to ensure access to all systems.', 7, '30 mins', 9),

-- Month 1 tasks
('mt-10', 'Functional Training Debriefs', 'Conduct debriefs for Facilities, MTS, and Sales training modules.', 30, '45 mins', 10)

ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  due_date_offset = EXCLUDED.due_date_offset,
  time_estimate = EXCLUDED.time_estimate,
  sort_order = EXCLUDED.sort_order;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify the seed data was inserted correctly:

-- SELECT COUNT(*) as module_count FROM training_modules;
-- SELECT COUNT(*) as okr_count FROM okrs;
-- SELECT COUNT(*) as kr_count FROM key_results;
-- SELECT COUNT(*) as task_count FROM manager_task_templates;
