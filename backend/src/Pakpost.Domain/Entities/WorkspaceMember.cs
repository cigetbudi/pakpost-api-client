using Pakpost.Domain.Enums;
namespace Pakpost.Domain.Entities;
public sealed class WorkspaceMember
{
    private WorkspaceMember() { }
    public Guid WorkspaceId { get; private set; }
    public Guid UserId { get; private set; }
    // Legacy role stays for backward compatibility with existing members and clients.
    // Authorization MUST use Roles and never this property.
    public WorkspaceRole Role { get; private set; }
    public DateTimeOffset JoinedAt { get; private set; }
    public List<WorkspaceMemberRole> Roles { get; private set; } = [];
    public WorkspaceMember(Guid workspaceId, Guid userId, WorkspaceRole role,
        IEnumerable<WorkspaceAccessRole>? roles = null)
    {
        WorkspaceId = workspaceId; UserId = userId; Role = role;
        JoinedAt = DateTimeOffset.UtcNow;
        WorkspaceAccessRole[] assigned = roles is not null ? roles.Distinct().ToArray() : role switch
        {
            WorkspaceRole.Owner => new[] { WorkspaceAccessRole.TeamLead },
            WorkspaceRole.Admin => new[] { WorkspaceAccessRole.WorkspaceAdmin, WorkspaceAccessRole.Developer },
            _ => new[] { WorkspaceAccessRole.Developer }
        };
        if(assigned.Length==0)throw new ArgumentException("Member needs at least one role",nameof(roles));
        foreach(var r in assigned)Roles.Add(new WorkspaceMemberRole(workspaceId,userId,r));
    }
    public void ReplaceRoles(IEnumerable<WorkspaceAccessRole> roles)
    {
        var next=roles.Distinct().ToHashSet();
        if(next.Count==0)throw new ArgumentException("Member needs at least one role",nameof(roles));
        Roles.RemoveAll(r=>!next.Contains(r.Role));
        foreach(var role in next)
            if(!Roles.Any(x=>x.Role==role))Roles.Add(new WorkspaceMemberRole(WorkspaceId,UserId,role));
        // The legacy column is never used for access checks; keep it descriptive.
        if(Role!=WorkspaceRole.Owner)
            Role=next.Contains(WorkspaceAccessRole.TeamLead)||next.Contains(WorkspaceAccessRole.WorkspaceAdmin)
                ?WorkspaceRole.Admin:WorkspaceRole.Member;
    }
}
