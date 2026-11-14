using Microsoft.EntityFrameworkCore;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;
namespace Pakpost.Infrastructure.Persistence.Repositories;
public sealed class WorkspaceRepository(PakpostDbContext db) : IWorkspaceRepository
{
    public Task<Workspace?> FindAsync(Guid id, CancellationToken ct)
        => db.Workspaces.FirstOrDefaultAsync(x => x.Id == id, ct);
    public Task<WorkspaceMember?> FindMemberAsync(Guid workspaceId, Guid userId, CancellationToken ct)
        => db.WorkspaceMembers.AsNoTracking().FirstOrDefaultAsync(x => x.WorkspaceId == workspaceId && x.UserId == userId, ct);
    public async Task<IReadOnlyList<Workspace>> ListForUserAsync(Guid userId, CancellationToken ct)
        => await db.Workspaces.AsNoTracking().Where(w => db.WorkspaceMembers.Any(m => m.WorkspaceId == w.Id && m.UserId == userId))
            .OrderBy(x => x.Name).ToListAsync(ct);
    public async Task<IReadOnlyList<WorkspaceMember>> ListMembersAsync(Guid workspaceId, CancellationToken ct)
        => await db.WorkspaceMembers.AsNoTracking().Where(m => m.WorkspaceId == workspaceId).OrderBy(m => m.JoinedAt).ToListAsync(ct);
    public void Add(Workspace workspace) => db.Workspaces.Add(workspace);
    public void AddMember(WorkspaceMember member) => db.WorkspaceMembers.Add(member);
}
