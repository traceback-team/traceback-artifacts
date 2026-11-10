CREATE TABLE accounts (
  id bigint PRIMARY KEY,
  balance numeric(12, 2) NOT NULL
);

INSERT INTO accounts (id, balance) VALUES (7, 1000.00);
