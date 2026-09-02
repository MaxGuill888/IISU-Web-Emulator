create table if not exists accounts (
    id text primary key,
    username text not null unique collate nocase,
    email text not null unique collate nocase,
    password_hash text not null,
    password_salt text not null,
    created_at text not null default current_timestamp
);

create table if not exists friendships (
    user_id text not null references accounts(id) on delete cascade,
    friend_id text not null references accounts(id) on delete cascade,
    status text not null check (status in ('accepted', 'blocked')),
    created_at text not null default current_timestamp,
    primary key (user_id, friend_id),
    check (user_id != friend_id)
);

create index if not exists accounts_username_idx on accounts(username);
