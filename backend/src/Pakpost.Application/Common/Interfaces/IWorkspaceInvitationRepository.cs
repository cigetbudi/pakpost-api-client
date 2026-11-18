using Pakpost.Domain.Entities;

namespace Pakpost.Application.Common.Interfaces;

public interface IWorkspaceInvitationRepository
{
    Task<IReadOnlyList<WorkspaceInvitation>> ListAsync(Guid workspaceId, CancellationToken ct);
    Task<WorkspaceInvitation?> FindAsync(Guid id, CancellationToken ct);
    Task<WorkspaceInvitation?> FindByTokenHashAsync(string hash, CancellationToken ct);
    Task<bool> HasPendingAsync(Guid workspaceId, string email, DateTimeOffset now, CancellationToken ct);
    Task<int> CountPendingAsync(Guid workspaceId, DateTimeOffset now, CancellationToken ct);
    void Add(WorkspaceInvitation invitation);
}
