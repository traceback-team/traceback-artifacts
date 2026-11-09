CREATE TABLE accounts (
  id bigint PRIMARY KEY,
  balance decimal(12, 2) NOT NULL
) ENGINE=InnoDB;

INSERT INTO accounts (id, balance) VALUES (7, 1000.00);
