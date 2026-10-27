-- Story #355 (E27, plan v2 B.19). Help and FAQ. The answers live in a table so the owner can change a word without a release. Only the service role reads
-- (the Edge Function `help` holds that key). The starter content below is plain words and says only what the product does today; the owner edits it.
create table faq (
  id bigint generated always as identity primary key,
  topic text not null check (length(topic) between 1 and 60),
  topic_position integer not null default 0,
  question text not null check (length(question) between 1 and 200),
  answer text not null check (length(answer) between 1 and 1000),
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table faq enable row level security;
revoke all on faq from public, anon, authenticated;

create function help_v2() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ok', true, 'topics', coalesce(jsonb_agg(jsonb_build_object('topic', t.topic, 'items', t.items) order by t.tp, t.topic), '[]'::jsonb))
  from (
    select f.topic, min(f.topic_position) as tp,
      jsonb_agg(jsonb_build_object('question', f.question, 'answer', f.answer) order by f.position, f.id) as items
    from faq f where f.active group by f.topic
  ) t
$$;
revoke all on function help_v2() from public, anon, authenticated;
grant execute on function help_v2() to service_role;

insert into faq (topic, topic_position, question, answer, position) values
  ('Ordering', 1, 'How do I place an order?', 'Type your pin code to see the kitchen near you. Add dishes, open your bill and tap Place order.', 1),
  ('Ordering', 1, 'Can I cancel my order?', 'Yes, until the kitchen starts cooking. Open your order and tap Cancel order. After that, call the kitchen.', 2),
  ('Paying', 2, 'How can I pay?', 'Pay the rider cash at the door. UPI and card are being switched on.', 1),
  ('Paying', 2, 'What if an online payment does not go through?', 'Nothing is charged for a payment that fails. If it is not paid in 15 minutes, the order goes back to cash.', 2),
  ('Delivery', 3, 'How long will it take?', 'About 45 minutes. Your order screen shows the time we promise.', 1),
  ('Delivery', 3, 'What if my order is late?', 'If we deliver after the time we promised, we give you a coupon for your next order.', 2),
  ('Your account', 4, 'What happens when I delete my account?', 'Your details are hidden at once and removed a few weeks later. Your past orders stay, without your name, phone or address.', 1);
