using Pakpost.Domain.Enums;
namespace Pakpost.Domain.Entities;

public sealed class WorkspaceMember
{
    private WorkspaceMember() { }
    public Guid WorkspaceId { get; private set; }
    public Guid UserId { get; private set; }
    public WorkspaceRole Role { get; private set; }
    public DateTimeOffset JoinedAt { get; private set; }
    public WorkspaceMember(Guid workspaceId, Guid userId, WorkspaceRole role)
    {
        WorkspaceId = workspaceId; UserId = userId; Role = role;
        JoinedAt = DateTimeOffset.UtcNow;
    }
}
