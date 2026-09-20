import { DemoProductHome } from "@/components/demo-product-home";
import {
  DEMO_PRODUCTS,
  getDemoProductUser,
  getDemoSiteUrl,
} from "@/helpers/demo-product";

export const dynamic = "force-dynamic";

export default async function DemoShopPage() {
  const user = await getDemoProductUser("shop");
  const siteUrl = await getDemoSiteUrl();
  return (
    <DemoProductHome
      productKey="shop"
      user={user}
      redirectUri={`${siteUrl}${DEMO_PRODUCTS.shop.callback}`}
    />
  );
}
