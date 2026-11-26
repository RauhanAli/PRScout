CREATE TABLE "rate_limit" (
	"key" text PRIMARY KEY NOT NULL,
	"hits" integer NOT NULL,
	"resetAt" timestamp with time zone NOT NULL
);
