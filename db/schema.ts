import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// Better Auth Tables
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

// PropTech Tables

// Properties table for real estate listings
export const properties = pgTable("properties", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull(), // 'apartment', 'villa', 'commercial', 'office'
  purpose: text("purpose").notNull(), // 'rent', 'sale'
  price: integer("price").notNull(),
  currency: text("currency").notNull().default("SAR"),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  areaSqm: integer("areaSqm"),
  furnished: boolean("furnished").notNull().default(false),
  parking: boolean("parking").notNull().default(false),
  // Location details
  city: text("city").notNull(),
  neighborhood: text("neighborhood"),
  address: text("address"),
  latitude: text("latitude"), // Using text for precision
  longitude: text("longitude"), // Using text for precision
  // Owner information
  ownerId: text("ownerId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // Status and metadata
  status: text("status").notNull().default("active"), // 'active', 'rented', 'sold', 'inactive'
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

// Property images for galleries
export const propertyImages = pgTable("propertyImages", {
  id: text("id").primaryKey(),
  propertyId: text("propertyId")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  imageUrl: text("imageUrl").notNull(),
  isPrimary: boolean("isPrimary").notNull().default(false),
  orderIndex: integer("orderIndex").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

// Property inquiries from potential buyers/renters
export const inquiries = pgTable("inquiries", {
  id: text("id").primaryKey(),
  propertyId: text("propertyId")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  inquirerId: text("inquirerId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  message: text("message"),
  contactPhone: text("contactPhone"),
  preferredContact: text("preferredContact").default("email"), // 'email', 'phone', 'whatsapp'
  status: text("status").notNull().default("pending"), // 'pending', 'responded', 'closed'
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

// Property viewing appointments
export const viewings = pgTable("viewings", {
  id: text("id").primaryKey(),
  propertyId: text("propertyId")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  inquirerId: text("inquirerId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  scheduledDate: timestamp("scheduledDate").notNull(),
  durationMinutes: integer("durationMinutes").notNull().default(30),
  status: text("status").notNull().default("scheduled"), // 'scheduled', 'completed', 'cancelled'
  notes: text("notes"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});
