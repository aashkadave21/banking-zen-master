-- ============ ENUMS ============
create type public.app_role as enum ('customer','premium_customer','bank_admin','fraud_analyst','auditor');
create type public.kyc_status as enum ('Pending','Verified','Rejected');
create type public.account_type as enum ('Savings','Current');
create type public.account_status as enum ('PendingKYC','Active','Frozen','Deactivated','Dormant');
create type public.txn_status as enum ('Initiated','AwaitingOTP','Posted','Pending','Settled','Failed','Blocked','Cancelled','Reversed');
create type public.transfer_type as enum ('Own','Beneficiary','Reversal');
create type public.risk_band as enum ('LOW','MEDIUM','HIGH');
create type public.case_status as enum ('Open','Escalated','UnderReview','ConfirmedFraud','FalsePositive','Closed');
create type public.otp_purpose as enum ('Transfer','StepUp','Beneficiary','NewDevice','Deactivate');

-- ============ D1: USER / CUSTOMER / ACCOUNT ============
create table public.profiles (            -- UML: User (interface)
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  mobile_no text not null check (mobile_no ~ '^[0-9]{10}$'),
  date_of_birth date,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
create table public.customers (           -- UML: Customer / PremiumCustomer
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  customer_id text not null unique,
  kyc_status public.kyc_status not null default 'Pending',
  is_premium boolean not null default false,
  transfer_limit numeric(15,2) not null default 200000 check (transfer_limit > 0),
  daily_limit numeric(15,2) not null default 500000 check (daily_limit > 0),
  created_at timestamptz not null default now()
);
create table public.kyc_records (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  reference_no text not null unique,
  status public.kyc_status not null default 'Pending',
  provider text not null default 'SIMULATED-KYC',
  remarks text,
  submitted_at timestamptz not null default now(),
  decided_at timestamptz
);
create table public.accounts (            -- UML: Account (interface)
  id uuid primary key default gen_random_uuid(),
  account_number text not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  account_type public.account_type not null,
  balance numeric(15,2) not null default 0 check (balance >= 0),
  min_balance numeric(15,2) not null default 0 check (min_balance >= 0),
  status public.account_status not null default 'PendingKYC',
  has_open_loan boolean not null default false,
  has_open_dormancy_case boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.accounts(customer_id);

-- ============ D3: BENEFICIARY ============
create table public.beneficiaries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  nickname text not null,
  beneficiary_name text not null,
  account_number text not null check (account_number ~ '^[0-9]{9,18}$'),
  ifsc text not null check (ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  is_active boolean not null default false,
  activated_at timestamptz,
  cooling_off_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, account_number, ifsc)
);

-- ============ D2: TRANSACTION LEDGER ============
create table public.transactions (        -- UML: Transaction
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  idempotency_key text not null,
  initiated_by uuid not null references public.customers(id),
  source_account_id uuid references public.accounts(id),
  dest_account_id uuid references public.accounts(id),
  beneficiary_id uuid references public.beneficiaries(id),
  original_transaction_id uuid references public.transactions(id),
  type public.transfer_type not null,
  amount numeric(15,2) not null check (amount > 0),
  remarks text,
  status public.txn_status not null default 'Initiated',
  risk_score int check (risk_score between 0 and 100),
  risk_band public.risk_band,
  triggered_rules jsonb not null default '[]'::jsonb,
  failure_reason text,
  created_at timestamptz not null default now(),
  posted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (initiated_by, idempotency_key)
);
create index on public.transactions(source_account_id, created_at);
create index on public.transactions(dest_account_id, created_at);

create table public.ledger_entries (
  id bigint generated always as identity primary key,
  transaction_id uuid not null references public.transactions(id),
  account_id uuid references public.accounts(id),      -- null = bank clearing/suspense ledger
  ledger_code text not null default 'CUSTOMER',         -- CUSTOMER | CLEARING
  entry_type text not null check (entry_type in ('DEBIT','CREDIT')),
  amount numeric(15,2) not null check (amount > 0),
  balance_after numeric(15,2),
  narration text,
  created_at timestamptz not null default now()
);
create index on public.ledger_entries(account_id, created_at);
create index on public.ledger_entries(transaction_id);

create table public.settlement_records (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null unique references public.transactions(id),
  network text not null default 'SIMULATED-CLEARING',
  idempotency_key text not null unique,
  status text not null check (status in ('Submitted','Settled','Failed','Timeout','Reconciled')),
  outcome_note text,
  submitted_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid
);

-- ============ OTP ============
create table public.otp_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  purpose public.otp_purpose not null,
  subject_id uuid,
  code_hash text not null,
  attempts int not null default 0,
  max_attempts int not null default 3,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.otp_challenges(user_id, purpose, subject_id);

-- ============ D5: FRAUD RULE & RISK CASE ============
create table public.fraud_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null,
  weight int not null check (weight between 0 and 100),
  enabled boolean not null default true,
  params jsonb not null default '{}'::jsonb,
  version int not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create table public.fraud_cases (         -- UML: FraudCase
  id uuid primary key default gen_random_uuid(),
  case_id text not null unique,
  transaction_id uuid not null unique references public.transactions(id),  -- Transaction 0..1 triggers FraudCase
  account_id uuid not null references public.accounts(id),
  risk_score int not null check (risk_score between 0 and 100),
  risk_band public.risk_band not null,
  triggered_rules jsonb not null default '[]'::jsonb,
  status public.case_status not null default 'Open',
  assigned_analyst uuid references public.profiles(id),
  escalation_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.fraud_case_reviews (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.fraud_cases(id) on delete cascade,
  analyst_id uuid not null references public.profiles(id),
  decision public.case_status not null,
  remarks text not null check (char_length(remarks) >= 10),
  created_at timestamptz not null default now()
);

-- ============ AUTH SUPPORT ============
create table public.login_events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  identifier text not null,
  success boolean not null,
  reason text,
  device_fingerprint text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index on public.login_events(identifier, created_at);
create table public.login_lockouts (
  identifier text primary key,
  failed_count int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
create table public.known_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  fingerprint text not null,
  first_seen timestamptz not null default now(),
  unique (user_id, fingerprint)
);

-- ============ D9: AUDIT LOG ============
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_logs(entity, entity_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null default 'IN_APP (simulated SMS/Email)',
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.system_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ============ GRANTS (read-only for clients; all writes via server) ============
grant select on public.profiles, public.user_roles, public.customers, public.kyc_records, public.accounts,
  public.beneficiaries, public.transactions, public.ledger_entries, public.settlement_records,
  public.fraud_rules, public.fraud_cases, public.fraud_case_reviews, public.login_events,
  public.audit_logs, public.notifications, public.system_config to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.customers enable row level security;
alter table public.kyc_records enable row level security;
alter table public.accounts enable row level security;
alter table public.beneficiaries enable row level security;
alter table public.transactions enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.settlement_records enable row level security;
alter table public.otp_challenges enable row level security;
alter table public.fraud_rules enable row level security;
alter table public.fraud_cases enable row level security;
alter table public.fraud_case_reviews enable row level security;
alter table public.login_events enable row level security;
alter table public.login_lockouts enable row level security;
alter table public.known_devices enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.system_config enable row level security;

-- ============ HELPERS ============
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.my_customer_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.customers where user_id = auth.uid()
$$;
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(),'bank_admin') or public.has_role(auth.uid(),'fraud_analyst') or public.has_role(auth.uid(),'auditor')
$$;

-- ============ POLICIES ============
create policy "own profile" on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff());
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "own customer" on public.customers for select to authenticated using (user_id = auth.uid() or public.is_staff());
create policy "own kyc" on public.kyc_records for select to authenticated using (customer_id = public.my_customer_id() or public.has_role(auth.uid(),'bank_admin'));
create policy "own accounts" on public.accounts for select to authenticated using (customer_id = public.my_customer_id() or public.is_staff());
create policy "own beneficiaries" on public.beneficiaries for select to authenticated using (customer_id = public.my_customer_id());
create policy "own transactions" on public.transactions for select to authenticated using (
  initiated_by = public.my_customer_id()
  or dest_account_id in (select id from public.accounts where customer_id = public.my_customer_id())
  or public.is_staff());
create policy "own ledger" on public.ledger_entries for select to authenticated using (
  account_id in (select id from public.accounts where customer_id = public.my_customer_id()) or public.is_staff());
create policy "staff settlements" on public.settlement_records for select to authenticated using (public.has_role(auth.uid(),'bank_admin') or public.has_role(auth.uid(),'auditor'));
create policy "staff rules" on public.fraud_rules for select to authenticated using (public.is_staff());
create policy "staff cases" on public.fraud_cases for select to authenticated using (public.is_staff());
create policy "staff reviews" on public.fraud_case_reviews for select to authenticated using (public.is_staff());
create policy "own login events" on public.login_events for select to authenticated using (user_id = auth.uid() or public.is_staff());
create policy "staff audit" on public.audit_logs for select to authenticated using (actor_id = auth.uid() or public.is_staff());
create policy "own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "read config" on public.system_config for select to authenticated using (true);

-- ============ IMMUTABLE LEDGER ============
create or replace function public.prevent_ledger_mutation() returns trigger language plpgsql as $$
begin raise exception 'Ledger entries are immutable; post a compensating entry instead'; end $$;
create trigger ledger_immutable before update or delete on public.ledger_entries
  for each row execute function public.prevent_ledger_mutation();
create trigger audit_immutable before update or delete on public.audit_logs
  for each row execute function public.prevent_ledger_mutation();

-- ============ REGISTRATION TRIGGER (Customer.register) ============
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := new.raw_user_meta_data;
  cust uuid;
  dob date;
  acct_type public.account_type;
begin
  if coalesce(m->>'kind','customer') <> 'customer' then
    insert into public.profiles(id, full_name, email, mobile_no)
    values (new.id, coalesce(m->>'full_name','Staff'), new.email, coalesce(m->>'mobile_no','0000000000'));
    return new;
  end if;
  dob := (m->>'date_of_birth')::date;
  if dob is null or dob > (current_date - interval '18 years') then
    raise exception 'Applicant must be at least 18 years old';
  end if;
  acct_type := coalesce(m->>'account_type','Savings')::public.account_type;
  insert into public.profiles(id, full_name, email, mobile_no, date_of_birth, address)
  values (new.id, m->>'full_name', new.email, m->>'mobile_no', dob, m->>'address');
  insert into public.user_roles(user_id, role) values (new.id, 'customer');
  insert into public.customers(user_id, customer_id)
  values (new.id, 'CUST' || lpad((floor(random()*100000000))::text, 8, '0'))
  returning id into cust;
  insert into public.kyc_records(customer_id, reference_no)
  values (cust, 'KYC-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(md5(random()::text),1,6)));
  insert into public.accounts(account_number, customer_id, account_type, status, min_balance)
  values ('5010' || lpad((floor(random()*10000000000))::text, 10, '0'), cust, acct_type, 'PendingKYC',
          case when acct_type = 'Current' then 10000 else 1000 end);
  insert into public.audit_logs(actor_id, action, entity, entity_id, details)
  values (new.id, 'CUSTOMER_REGISTERED', 'customer', cust::text, jsonb_build_object('email', new.email));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ SEED: config + fraud rules ============
insert into public.system_config(key, value) values
  ('limits', '{"per_transaction":200000,"daily":500000,"premium_per_transaction":1000000,"premium_daily":2500000}'),
  ('beneficiary', '{"cooling_off_minutes":30}'),
  ('otp', '{"length":6,"validity_seconds":300,"max_attempts":3,"stepup_max_failures":2}'),
  ('risk_bands', '{"low_max":39,"medium_max":79}'),
  ('auth', '{"max_failed_logins":5,"lockout_minutes":30}');

insert into public.fraud_rules(code, name, description, weight, params) values
  ('LARGE_AMOUNT','Unusually large amount','Amount is at or above a configured share of the per-transaction limit',35,'{"threshold":100000}'),
  ('VELOCITY','Rapid repeated transfers','Several transfers from the same account in a short window',25,'{"count":3,"window_minutes":10}'),
  ('NEW_BENEFICIARY','New beneficiary exposure','Beneficiary was activated recently',20,'{"within_hours":24}'),
  ('HIGH_FREQUENCY','Unusual daily frequency','Many transfers on the same day compared to normal',10,'{"count":6}'),
  ('NEW_DEVICE_LOGIN','Suspicious login context','Current session began on a newly recognised device',15,'{}'),
  ('BALANCE_DRAIN','Balance drain','Transfer would use most of the available balance',20,'{"ratio":0.9}');