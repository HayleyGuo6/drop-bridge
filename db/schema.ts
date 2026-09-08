import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const files = sqliteTable('files', {
 id:text('id').primaryKey(), name:text('name').notNull(), size:integer('size').notNull(), created:integer('created').notNull(), expires:integer('expires').notNull(), status:text('status').notNull(),
}, t=>[index('files_expiry').on(t.expires)]);
