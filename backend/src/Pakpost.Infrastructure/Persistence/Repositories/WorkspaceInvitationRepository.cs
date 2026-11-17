using Microsoft.EntityFrameworkCore;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;
namespace Pakpost.Infrastructure.Persistence.Repositories;
public sealed class WorkspaceInvitationRepository(PakpostDbContext db):IWorkspaceInvitationRepository
{
    public async Task<IReadOnlyList<WorkspaceInvitation>> ListAsync(Guid workspaceId,CancellationToken ct)
        =>await db.WorkspaceInvitations.AsNoTracking()
            .Where(x=>x.WorkspaceId==workspaceId).OrderByDescending(x=>x.CreatedAt).Take(200).ToListAsync(ct);
    public Task<WorkspaceInvitation?> FindAsync(Guid id,CancellationToken ct)
        =>db.WorkspaceInvitations.FirstOrDefaultAsync(x=>x.Id==id,ct);
    public Task<WorkspaceInvitation?> FindByTokenHashAsync(string hash,CancellationToken ct)
        =>db.WorkspaceInvitations.FirstOrDefaultAsync(x=>x.TokenHash==hash,ct);
    public Task<bool> HasPendingAsync(Guid workspaceId,string email,DateTimeOffset now,CancellationToken ct)
        =>db.WorkspaceInvitations.AnyAsync(x=>x.WorkspaceId==workspaceId&&x.Email==email&&
            x.AcceptedAt==null&&x.RevokedAt==null&&x.ExpiresAt>now,ct);
    public Task<int> CountPendingAsync(Guid workspaceId,DateTimeOffset now,CancellationToken ct)
        =>db.WorkspaceInvitations.CountAsync(x=>x.WorkspaceId==workspaceId&&
            x.AcceptedAt==null&&x.RevokedAt==null&&x.ExpiresAt>now,ct);
    public void Add(WorkspaceInvitation invitation)=>db.WorkspaceInvitations.Add(invitation);
}
