export function StructuredData() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://focoman.web.app';
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${baseUrl}/#organization`,
        "name": "Focoman",
        "url": `${baseUrl}`,
        "logo": `${baseUrl}/brand/focoman-logo.png`,
        "description": "Business operating system for photography studios.",
      },
      {
        "@type": "WebSite",
        "@id": `${baseUrl}/#website`,
        "url": `${baseUrl}`,
        "name": "Focoman",
        "publisher": {
          "@id": `${baseUrl}/#organization`,
        },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${baseUrl}/#application`,
        "name": "Focoman Studio BOS",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web",
        "url": `${baseUrl}`,
        "description": "A Complete Business Operating System for Photography Studios. Unifies orders, shoot schedules, dynamic service workflows, crew planning, offline payments, and client deliveries.",
        "offers": [
          {
            "@type": "Offer",
            "name": "Free",
            "price": "0",
            "priceCurrency": "INR",
            "description": "Essential Order Management System (OMS) with unlimited confirmed orders.",
          },
          {
            "@type": "Offer",
            "name": "Starter",
            "price": "999",
            "priceCurrency": "INR",
            "billingDuration": "P1M",
            "description": "20 GB Cloud Proofing Storage, Shareable Links and Client Photo Selection, Instagram & Website / Google Maps lead capture, CRM, ERP, and basic business dashboard.",
          },
          {
            "@type": "Offer",
            "name": "Professional",
            "price": "1999",
            "priceCurrency": "INR",
            "billingDuration": "P1M",
            "description": "50 GB Cloud Proofing Storage & photo selection gallery, WhatsApp Business lead capture, WhatsApp Operations and Bot, pre-anniversary reminders, invoices and receipts, and advanced reports.",
          },
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
