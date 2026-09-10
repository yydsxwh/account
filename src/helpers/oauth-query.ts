export type ProductLoginQuery = {
  clientId: string;
  redirectUri: string;
  state: string;
};

export function readProductLoginQuery(searchParams: {
  client_id?: string;
  redirect_uri?: string;
  state?: string;
}): ProductLoginQuery | null {
  const clientId = searchParams.client_id?.trim() || "";
  const redirectUri = searchParams.redirect_uri?.trim() || "";
  if (!clientId || !redirectUri) return null;
  return {
    clientId,
    redirectUri,
    state: searchParams.state?.trim() || "",
  };
}

export function productLoginSearch(query: ProductLoginQuery) {
  const params = new URLSearchParams({
    client_id: query.clientId,
    redirect_uri: query.redirectUri,
  });
  if (query.state) params.set("state", query.state);
  return params.toString();
}
