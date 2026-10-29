-- Story #619 (boards L1, L2). The customer's menu follows the kitchen live: a kitchen's switch and hours, and a dish going sold out, reach the phone in seconds.
-- Both tables are readable by anyone (the menu is public), so Realtime may carry their changes. Before this the phone read them once and needed a reload.
alter publication supabase_realtime add table kitchens, menu_items;
