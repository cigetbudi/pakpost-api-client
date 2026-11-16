using Pakpost.Domain.Enums;
namespace Pakpost.Domain.Entities;
public sealed class WorkspaceMemberRole
{
    private WorkspaceMemberRole() { }
    public Guid WorkspaceId { get; private set; }
    public Guid UserId { get; private set; }
    public WorkspaceAccessRole Role { get; private set; }
    public WorkspaceMemberRole(Guid workspaceId,Guid userId,WorkspaceAccessRole role)
    { WorkspaceId=workspaceId; UserId=userId; Role=role; }
}
