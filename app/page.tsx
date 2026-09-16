import Dashboard from "@/components/dashboard";
import dashboardData from "@/public/data/dashboard.json";

export default function Home() {
  return <Dashboard data={dashboardData} />;
}

