-- Story #880 (epic E32). Removing a rider who has old orders failed: orders.rider_id pointed to riders(user_id) with no delete rule.
-- Now the rider row can go and every order stays; an order that named that rider is left with no rider. Open orders go back to dispatch, as admin_remove_person already did.
alter table orders drop constraint orders_rider_id_fkey;
alter table orders add constraint orders_rider_fk_set_null foreign key (rider_id) references riders (user_id) on delete set null;
