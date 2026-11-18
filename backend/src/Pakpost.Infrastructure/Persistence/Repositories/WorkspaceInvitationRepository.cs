using Microsoft.EntityFrameworkCore;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;

namespace Pakpost.Infrastructure.Persistence.Repositories;

public sealed class WorkspaceInvitationRepository(PakpostDbContext db) : IWorkspaceInvitationRepository
{
    public async Task<IReadOnlyList<WorkspaceInvitation>> ListAsync(Guid workspaceId, CancellationToken ct) =>
        await db.WorkspaceInvitations
            .AsNoTracking()
            .Where(invitation => invitation.WorkspaceId == workspaceId)
            .OrderByDescending(invitation => invitation.CreatedAt)
            .Take(200)
            .ToListAsync(ct);

    public Task<WorkspaceInvitation?> FindAsync(Guid id, CancellationToken ct) =>
        db.WorkspaceInvitations.FirstOrDefaultAsync(invitation => invitation.Id == id, ct);

    public Task<WorkspaceInvitation?> FindByTokenHashAsync(string hash, CancellationToken ct) =>
        db.WorkspaceInvitations.FirstOrDefaultAsync(invitation => invitation.TokenHash == hash, ct);

    public Task<bool> HasPendingAsync(
        Guid workspaceId,
        string email,
        DateTimeOffset now,
        CancellationToken ct) =>
        db.WorkspaceInvitations.AnyAsync(invitation =>
            invitation.WorkspaceId == workspaceId &&
            invitation.Email == email &&
            invitation.AcceptedAt == null &&
            invitation.RevokedAt == null &&
            invitation.ExpiresAt > now,
            ct);

    public Task<int> CountPendingAsync(
        Guid workspaceId,
        DateTimeOffset now,
        CancellationToken ct) =>
        db.WorkspaceInvitations.CountAsync(invitation =>
            invitation.WorkspaceId == workspaceId &&
            invitation.AcceptedAt == null &&
            invitation.RevokedAt == null &&
            invitation.ExpiresAt > now,
            ct);

    public void Add(WorkspaceInvitation invitation) => db.WorkspaceInvitations.Add(invitation);
}
