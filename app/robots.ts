import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/appointment", "/dentist", "/ortho", "/doctor", "/login", "/patients/"],
      },
    ],
    sitemap: "https://orisalign.com/sitemap.xml",
    host: "https://orisalign.com",
  };
}
