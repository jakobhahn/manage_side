import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function HomePage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">
          Welcome to Hans Restaurant App
        </h1>
        <p className="text-xl text-muted-foreground">
          Modern restaurant management made simple
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Menu Management</CardTitle>
            <CardDescription>
              Create and manage your restaurant menu with ease
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full">Manage Menu</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order Tracking</CardTitle>
            <CardDescription>
              Track orders in real-time from kitchen to table
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full">View Orders</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Analytics</CardTitle>
            <CardDescription>
              Get insights into your restaurant performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full">View Analytics</Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
