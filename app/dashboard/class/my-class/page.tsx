import { redirect } from "next/navigation";

export default async function MyClassRedirect({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams;
  const tab = params.tab;
  const queryString = tab ? `?tab=${tab}` : '';
  redirect(`/dashboard/class/c8${queryString}`);
}
