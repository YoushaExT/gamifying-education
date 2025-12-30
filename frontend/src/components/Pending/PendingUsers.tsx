import { Skeleton } from "../ui/skeleton"

const PendingUsers = () => (
  <div className="rounded-md border">
    <table className="w-full">
      <thead>
        <tr className="border-b bg-muted/50">
          <th className="p-2 text-left text-sm font-medium">Full name</th>
          <th className="p-2 text-left text-sm font-medium">Email</th>
          <th className="p-2 text-left text-sm font-medium">Role</th>
          <th className="p-2 text-left text-sm font-medium">Status</th>
          <th className="p-2 text-left text-sm font-medium">Actions</th>
        </tr>
      </thead>
      <tbody>
        {[...Array(5)].map((_, index) => (
          <tr key={index} className="border-b last:border-0">
            <td className="p-2">
              <Skeleton className="h-4 w-full" />
            </td>
            <td className="p-2">
              <Skeleton className="h-4 w-full" />
            </td>
            <td className="p-2">
              <Skeleton className="h-4 w-full" />
            </td>
            <td className="p-2">
              <Skeleton className="h-4 w-full" />
            </td>
            <td className="p-2">
              <Skeleton className="h-4 w-full" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

export default PendingUsers
