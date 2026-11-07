CREATE TABLE salas (
 codigo TEXT PRIMARY KEY NOT NULL,
 dados TEXT NOT NULL,
 revisao INTEGER NOT NULL DEFAULT 0,
 expira_em INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX salas_expiracao ON salas (expira_em);
--> statement-breakpoint
CREATE TABLE limites (
 chave TEXT PRIMARY KEY NOT NULL,
 janela INTEGER NOT NULL,
 quantidade INTEGER NOT NULL DEFAULT 1
);
--> statement-breakpoint
CREATE INDEX limites_janela ON limites (janela);
