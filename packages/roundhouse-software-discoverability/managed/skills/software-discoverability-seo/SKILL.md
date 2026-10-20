---
name: seo-structured-data
description: Use when a task involves search engine optimization or structured data. Provides foundational guidance on SEO best practices, meta tags, structured data, and sitemaps.
---

# SEO and Structured Data

## Expert stance

Apply SEO best practices to make content discoverable and understandable by
search engines. SEO is not manipulation; it is ensuring content can be found by
those who need it.

## On-page SEO

### Title and description

- Write unique, descriptive `<title>` for every page (50-60 characters).
- Write unique, compelling `<meta name="description">` (150-160 characters).
- Include primary keywords naturally; avoid keyword stuffing.

### Headings

- Use one `<h1>` per page (the page title).
- Use `<h2>`–`<h6>` for structure; do not skip levels.
- Include keywords in headings where natural.

### Content

- Write for humans first, search engines second.
- Answer user questions clearly and completely.
- Use short paragraphs, lists, and headings for scannability.
- Include internal links to related content.

### URLs

- Use descriptive, readable URLs.
- Use hyphens to separate words.
- Keep URLs short and meaningful.
- Avoid parameters and session IDs.

### Images

- Use descriptive `alt` text.
- Use descriptive file names.
- Compress images for fast loading.

## Technical SEO

### Crawlability

- Use a `robots.txt` to guide crawlers.
- Submit an XML sitemap.
- Fix broken links (404 errors).
- Use canonical URLs to avoid duplicate content.

### Mobile

- Use responsive design.
- Ensure touch targets are large enough.
- Test with Google's Mobile-Friendly Test.

### Performance

- Optimize Core Web Vitals (LCP, INP, CLS).
- Use HTTPS.
- Minimize redirects.

### Structured data

- Use JSON-LD for structured data.
- Mark up content with Schema.org vocabulary.
- Test with Google's Rich Results Test.

## Structured data types

### Common types

- **Article:** Blog posts, news articles.
- **Product:** E-commerce products.
- **LocalBusiness:** Physical businesses.
- **Organization:** Companies, organizations.
- **Person:** Individual people.
- **BreadcrumbList:** Navigation breadcrumbs.
- **FAQPage:** Frequently asked questions.
- **HowTo:** Step-by-step guides.

### JSON-LD example

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Article Title",
  "author": {
    "@type": "Person",
    "name": "Author Name"
  },
  "datePublished": "2026-08-31",
  "image": "https://example.com/image.jpg"
}
```

## Best practices

- Do not block search engines from important content.
- Do not use cloaking (showing different content to users and search engines).
- Do not participate in link schemes.
- Monitor search console for issues.
- SEO is long-term; results take time.
