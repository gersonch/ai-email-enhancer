# Privacy Policy

## AI Email Enhancer

**Last updated:** April 2026

---

## 1. Introduction

AI Email Enhancer ("we", "our", "us") is a Chrome extension that helps users improve their email writing using artificial intelligence. This privacy policy explains how we collect, use, and protect your information.

---

## 2. Information We Collect

### 2.1 User Data (via Supabase Auth)

- Email address and authentication credentials
- Session tokens (JWT) for authentication
- User preferences and settings

### 2.2 API Keys

- **User-provided OpenAI API keys**: Stored locally in Chrome storage. We never access or store these keys on our servers.
- **Developer-provided API**: Uses our Supabase backend to call OpenAI. No user emails are stored on our servers.

### 2.3 Email Content

- When you use the extension, the email content is sent to our API for processing
- **We do not store, log, or retain** any email content after processing
- Email content is only used to generate the improved version and is immediately discarded

### 2.4 Usage Data

- Rate limiting data (in-memory, not persisted)
- Anonymous usage metrics (optional)

---

## 3. How We Use Information

- **Authentication**: To manage user sessions and account access
- **Email processing**: To generate improved email drafts via AI
- **Rate limiting**: To prevent abuse (20 requests per minute per user)
- **Configuration**: To remember user preferences (tone, length, language)

---

## 4. Data Storage & Security

- **Supabase**: User accounts and authentication are managed by Supabase (https://supabase.com)
- **Chrome Storage**: User API keys and preferences are stored locally in your browser
- **No persistent email storage**: Email content is never saved to any database
- **Encryption**: All API communications use HTTPS/TLS encryption

---

## 5. Third-Party Services

| Service  | Purpose                  | Data Shared                     |
| -------- | ------------------------ | ------------------------------- |
| Supabase | Authentication & Backend | Email, auth token               |
| OpenAI   | AI Processing            | Email content (for improvement) |

When users provide their own OpenAI API key, **we do not see or store** that key—it's used directly between the user's browser and OpenAI.

---

## 6. Data Retention

- **User accounts**: Retained until user deletes their account
- **Email content**: Never retained—processed and discarded immediately
- **API keys**: Stored locally until user removes them

---

## 7. User Rights

Users can:

- Delete their account (contact us)
- Remove their API key from the extension at any time
- Request access to their data (contact us)
- Export their data (contact us)

---

## 8. Children’s Privacy

Our service is not intended for users under 13 years of age. We do not knowingly collect information from children.

---

## 9. Changes to This Policy

We may update this policy from time to time. We will notify users of any material changes by updating the "Last updated" date above.

---

## 10. Contact Us

If you have questions about this privacy policy, please contact us:

**Email:** [YOUR-EMAIL-HERE]

---

## 11. Chrome Web Store Compliance

This extension complies with Chrome Web Store Developer Program Policies. We do not:

- Collect data from users without consent
- Use data for advertising
- Transfer data to third parties for marketing purposes
