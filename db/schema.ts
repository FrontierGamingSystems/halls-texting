import {sqliteTable,text,index} from 'drizzle-orm/sqlite-core';
export const halls=sqliteTable('halls',{id:text('id').primaryKey(),name:text('name').notNull(),city:text('city').notNull(),region:text('region').notNull(),record:text('record').notNull()});
export const messages=sqliteTable('messages',{id:text('id').primaryKey(),sender:text('sender').notNull(),body:text('body').notNull(),receivedAt:text('received_at').notNull(),day:text('day').notNull(),hallId:text('hall_id').references(()=>halls.id),candidates:text('candidates').notNull(),status:text('status').notNull(),kind:text('kind').notNull()},t=>[index('idx_messages_day_received').on(t.day,t.receivedAt)]);
export const syncState=sqliteTable('sync_state',{key:text('key').primaryKey(),value:text('value').notNull()});
