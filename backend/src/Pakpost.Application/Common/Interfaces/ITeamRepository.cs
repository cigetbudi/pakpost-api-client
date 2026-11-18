using Pakpost.Domain.Entities;

namespace Pakpost.Application.Common.Interfaces;

public interface ITeamRepository
{
    Task<Team?> FindAsync(Guid teamId, CancellationToken ct);
    Task<IReadOnlyList<Team>> ListAsync(Guid workspaceId, CancellationToken ct);
    Task<IReadOnlyList<TeamMember>> ListMembersAsync(Guid teamId, CancellationToken ct);
    Task<bool> HasMemberAsync(Guid teamId, Guid userId, CancellationToken ct);
    void Add(Team team);
    void AddMember(TeamMember member);
}
