import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: "https://orisalign.com",               lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: "https://orisalign.com/book",           lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: "https://orisalign.com/patient",        lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: "https://orisalign.com/terms",          lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: "https://orisalign.com/privacy-policy", lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: "https://orisalign.com/refund-policy",  lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
  ];
}
