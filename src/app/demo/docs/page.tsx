import { DemoProductHome } from "@/components/demo-product-home";
import {
  DEMO_PRODUCTS,
  getDemoProductUser,
  getDemoSiteUrl,
} from "@/helpers/demo-product";

export const dynamic = "force-dynamic";

export default async function DemoDocsPage() {
  const user = await getDemoProductUser("docs");
  const siteUrl = await getDemoSiteUrl();
  return (
    <DemoProductHome
      productKey="docs"
      user={user}
      redirectUri={`${siteUrl}${DEMO_PRODUCTS.docs.callback}`}
    />
  );
}
