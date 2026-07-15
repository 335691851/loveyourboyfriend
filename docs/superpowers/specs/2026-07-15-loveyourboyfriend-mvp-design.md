# Love Your Boyfriend MVP Design

## Product scope

Build a mobile-first responsive H5 chat application for an adult fictional male companion. The character has a youthful, energetic voice and a mature, emotionally stable personality. Users enter without passwords through Supabase Anonymous Auth and can exchange text and voice messages while the application retains conversation history and derived preferences for 90 days.

## Architecture

- `apps/web`: Next.js App Router, React, TypeScript and Tailwind CSS. Vercel watches `master` and deploys this directory.
- `apps/api`: Python 3.12, FastAPI and LangChain. Render watches `master` and deploys this directory.
- Supabase: anonymous authentication, PostgreSQL, private voice-message storage, RLS and scheduled 90-day cleanup.
- OpenAI: text generation through the configured chat model and low-latency voice through the configured realtime model.
- GitHub: one production branch named `master`; Vercel and Render deploy independently from the same repository.

## First scaffold milestone

The initial repository must be safe to import into Vercel and Render without production secrets. It includes a responsive mobile chat shell, a FastAPI health endpoint, configuration validation, tests, a Supabase migration, environment templates and deployment documentation. Real chat, voice and persistence integrations are intentionally deferred to subsequent tested increments.

## Data and security boundaries

- The browser receives only Supabase URL, publishable key and public application configuration.
- OpenAI keys, Supabase secret keys and the database connection string stay in Render.
- Every exposed application table uses RLS with `auth.uid() = user_id` ownership checks.
- Anonymous users cannot recover their identity after clearing browser storage or changing device.
- Raw messages, voice objects and derived memory expire after 90 days.
- The product is for adults and must clearly identify the character as fictional.

## Experience baseline

The UI uses the approved immersive black-rose palette with soft gradients, flat controls, restrained particles and mobile safe-area handling. The scaffold renders a polished empty conversation state and composer without making network calls.

