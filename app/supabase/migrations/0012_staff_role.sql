-- Story #135. A staff row says what the person does: 'kitchen' or 'rider'. Both read the kitchen's orders (0011); the apps decide what each role may tap.
alter table kitchen_staff add column role text not null default 'kitchen' check (role in ('kitchen', 'rider'));
