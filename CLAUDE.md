# Instructions for Claude

## Project Overview
This is a Next.js starter kit project with authentication, database integration, and modern development tooling.

## Tech Stack
- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: NextAuth.js
- **Analytics**: Vercel Analytics

## Project Structure
```
├── src/
│   ├── app/           # Next.js app router pages
│   ├── components/    # React components
│   ├── lib/          # Utility functions and configurations
│   ├── server/       # Server-side code
│   └── types/        # TypeScript type definitions
├── drizzle/          # Database migrations and schema
└── public/           # Static assets
```

## Common Commands
```bash
# Development
npm run dev          # Start development server

# Building
npm run build        # Build for production

# Database
npm run db:push      # Push schema changes to database
npm run db:studio    # Open Drizzle Studio

# Code Quality
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript type checking (if available)
```

## Important Guidelines

### Before Making Changes
1. Always check existing code patterns and conventions
2. Review imports and dependencies before adding new ones
3. Check package.json for available scripts and dependencies

### Code Style
- Follow existing TypeScript patterns
- Use Tailwind CSS for styling
- Utilize shadcn/ui components when available
- Maintain consistent file naming conventions

### Testing & Validation
- Run `npm run lint` after making code changes
- Ensure TypeScript types are properly defined
- Test changes in development before considering complete

### Database Changes
- Schema changes should be made in the Drizzle schema files
- Run `npm run db:push` after schema modifications
- Use Drizzle Studio (`npm run db:studio`) to verify changes

### Authentication
- Authentication is handled by NextAuth.js
- Auth configuration is typically in src/lib/auth or similar
- Protect routes using middleware or server-side checks

### Environment Variables
- Check .env.example for required environment variables
- Never commit sensitive data or API keys
- Use process.env for accessing environment variables

## Best Practices
1. Keep components small and focused
2. Use server components by default in Next.js App Router
3. Implement proper error handling
4. Follow RESTful API conventions
5. Maintain type safety throughout the application
6. Use async/await for asynchronous operations
7. Implement proper loading and error states

## Common Patterns
- Server actions for form submissions
- API routes in app/api/ directory
- Middleware for authentication checks
- Custom hooks for reusable logic
- Utility functions in lib/ directory

## Notes
- This is a starter kit, so it's designed to be extended
- Check recent commits for latest changes and patterns
- The main branch is used for production deployments