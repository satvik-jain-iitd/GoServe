-- Finding F300 (29 Oct 2026). The first seed (0002) listed Butter Chicken and Chicken Biryani of the seed kitchen without a veg flag, so they took the default (veg = true)
-- and the menu showed a veg mark on chicken. Set them to non-veg. Scoped to the seed kitchen and the two names, so nothing else changes; run twice it changes nothing more.
update menu_items set veg = false
 where kitchen_id = '11111111-1111-1111-1111-111111111111' and name in ('Butter Chicken', 'Chicken Biryani') and veg;
