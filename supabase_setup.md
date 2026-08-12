# 🛠️ Supabase Database & Storage Setup Guide

Follow these quick steps to set up your free Supabase database and link it to your website so that all added memories and journal letters become permanent and shared!

---

## 1. Create a Free Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign up/sign in with your GitHub account.
2. Click **New Project** and select your organization.
3. Fill in the details:
   - **Name**: `Anu & Vishu Love Journal`
   - **Database Password**: *Choose a secure password*
   - **Region**: *Select a region close to you*
4. Click **Create new project** and wait 1-2 minutes for the database to spin up.

---

## 2. Create the Database Tables
Once your project is ready, we need to create two tables: one for memories and one for letters.

1. In the left sidebar of your Supabase dashboard, click on **SQL Editor** (the `>_` icon).
2. Click **New Query**.
3. Paste the following SQL script into the editor:

```sql
-- 1. Create Memories Table
create table memories (
  id uuid default gen_random_uuid() primary key,
  image_path text not null,
  caption text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Read & Write permissions for anonymous public users
alter table memories enable row level security;
create policy "Allow public read access to memories" on memories for select using (true);
create policy "Allow public insert access to memories" on memories for insert with check (true);
create policy "Allow public delete access to memories" on memories for delete using (true);

-- 2. Create Letters Table
create table letters (
  id text primary key,
  recipient text not null,
  title text not null,
  content text not null,
  date_str text not null,
  time_str text not null,
  timestamp bigint not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Read & Write permissions for anonymous public users
alter table letters enable row level security;
create policy "Allow public read access to letters" on letters for select using (true);
create policy "Allow public insert access to letters" on letters for insert with check (true);
create policy "Allow public delete access to letters" on letters for delete using (true);

-- 3. Create Visitor History Table (For Anu's logins tracking)
create table visitor_history (
  id uuid default gen_random_uuid() primary key,
  login_date text not null,
  login_time text not null,
  logout_time text,
  session_duration text,
  active_time text,
  idle_time text,
  timestamp bigint not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Read & Write permissions for anonymous public users
-- 4. Create Daily Streak Messages Table
create table daily_streak_messages (
  id uuid default gen_random_uuid() primary key,
  sender text not null,
  message text not null,
  date_str text not null,
  time_str text not null,
  timestamp bigint not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Create Letter Comments Table
create table letter_comments (
  id uuid default gen_random_uuid() primary key,
  letter_id text not null,
  author_name text not null,
  comment_text text not null,
  date_str text not null,
  time_str text not null,
  timestamp bigint not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table letter_comments enable row level security;
create policy "Allow public read access to letter_comments" on letter_comments for select using (true);
create policy "Allow public insert access to letter_comments" on letter_comments for insert with check (true);
create policy "Allow public delete access to letter_comments" on letter_comments for delete using (true);

-- 6. Create Anu Care Tracker Table
create table anu_care_tracker (
  date_str text primary key,
  water numeric default 0.0,
  water_entries jsonb default '[]'::jsonb,
  breakfast boolean default false,
  lunch boolean default false,
  dinner boolean default false,
  extra_food boolean default false,
  points numeric default 0,
  water_bonus_awarded boolean default false,
  meals_bonus_awarded boolean default false,
  updated_at bigint not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table anu_care_tracker enable row level security;
create policy "Allow public read access to anu_care_tracker" on anu_care_tracker for select using (true);
create policy "Allow public insert access to anu_care_tracker" on anu_care_tracker for insert with check (true);
create policy "Allow public update access to anu_care_tracker" on anu_care_tracker for update using (true);
```

4. Click **Run** (bottom right). You should see `Success` or `Query returned no rows`.

---

## 3. Create the Storage Bucket (For Memory Photos)
To allow uploading pictures directly from your computer, we need to create a public storage bucket to hold the files:

1. In the left sidebar, click on **Storage** (the bucket/box icon).
2. Click **New Bucket**.
3. Name the bucket exactly: `memories-bucket`
4. Toggle the **Public bucket** switch to **ON** (so the website can read uploaded image links).
5. Click **Save**.
6. Set Up Access Policies:
   - Click on your new `memories-bucket`.
   - Click **Policies** on the left.
   - Under **Other policies (advanced)**, click **New Policy** -> **For full customization**.
   - Create 3 separate policies (Select, Insert, and Delete) allowing public/anonymous access to all objects inside `memories-bucket` (use target check `true` for all). This allows anyone on the site to upload and delete photos.

---

## 4. Paste API Keys into `config.js`
1. In the left sidebar of your Supabase dashboard, click on **Project Settings** (the gear icon) and go to **API**.
2. Copy your **Project URL** (under Project API keys).
3. Copy your **anon / public** API Key.
4. Open the `config.js` file in your website folder and paste them inside the `supabase` config block:

```javascript
    supabase: {
        url: "YOUR_SUPABASE_PROJECT_URL_HERE",
        anonKey: "YOUR_SUPABASE_ANON_KEY_HERE"
    },
```

5. Save `config.js` and refresh your browser! 

---

### 💡 How the Fallback Works
- If you haven't filled in the `url` and `anonKey` yet, the website **automatically falls back to LocalStorage** so it still works perfectly on your computer.
- Once you paste the keys, it seamlessly starts using Supabase in real-time, sharing all letters and memory photos instantly across any browser/device!
