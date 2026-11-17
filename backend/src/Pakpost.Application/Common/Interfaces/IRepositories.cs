using Pakpost.Domain.Entities;
namespace Pakpost.Application.Common.Interfaces;
public interface IUserRepository
{
    Task<User?> FindByIdAsync(Guid id, CancellationToken ct);
    Task<User?> FindByEmailAsync(string email, CancellationToken ct);
    void Add(User user);
}
public interface IUserExternalIdentityRepository
{
    Task<UserExternalIdentity?> FindByProviderSubjectAsync(string provider, string subject, CancellationToken ct);
    Task<UserExternalIdentity?> FindByUserProviderAsync(Guid userId, string provider, CancellationToken ct);
    void Add(UserExternalIdentity identity);
}
public sealed record GoogleIdentity(string Subject, string Email, string DisplayName);
public interface IGoogleIdentityVerifier
{
    Task<GoogleIdentity> VerifyAsync(string idToken, CancellationToken ct);
}
public interface IWorkspaceRepository
{
    Task<Workspace?> FindAsync(Guid id, CancellationToken ct);
    Task<WorkspaceMember?> FindMemberAsync(Guid workspaceId, Guid userId, CancellationToken ct);
    Task<WorkspaceMember?> FindMemberForUpdateAsync(Guid workspaceId, Guid userId, CancellationToken ct);
    Task<bool> AnyWorkspaceAsync(CancellationToken ct);
    Task<IReadOnlyList<Workspace>> ListForUserAsync(Guid userId, CancellationToken ct);
    Task<IReadOnlyList<WorkspaceMember>> ListMembersAsync(Guid workspaceId, CancellationToken ct);
    void Add(Workspace workspace);
    void AddMember(WorkspaceMember member);
}
public interface ICollectionRepository
{
    Task<Collection?> FindAsync(Guid id, CancellationToken ct);
    Task<IReadOnlyList<Collection>> ListAsync(Guid workspaceId, CancellationToken ct);
    Task<IReadOnlyDictionary<Guid,int>> CountRequestsAsync(Guid workspaceId, CancellationToken ct);
    void Add(Collection collection);
    void Remove(Collection collection);
}
public interface ITeamRepository
{
    Task<Team?> FindAsync(Guid teamId,CancellationToken ct);
    Task<IReadOnlyList<Team>> ListAsync(Guid workspaceId,CancellationToken ct);
    Task<IReadOnlyList<TeamMember>> ListMembersAsync(Guid teamId,CancellationToken ct);
    Task<bool> HasMemberAsync(Guid teamId,Guid userId,CancellationToken ct);
    void Add(Team team);
    void AddMember(TeamMember member);
}
public interface ISavedRequestRepository
{
    Task<SavedRequest?> FindAsync(Guid id, CancellationToken ct);
    Task<IReadOnlyList<SavedRequest>> ListAsync(Guid collectionId, CancellationToken ct);
    void Add(SavedRequest value);
    void Remove(SavedRequest value);
}
public interface ISavedRequestRevisionRepository
{
    Task<bool> AnyAsync(Guid requestId,CancellationToken ct);
    Task<IReadOnlyList<SavedRequestRevision>> ListAsync(Guid requestId,int take,CancellationToken ct);
    Task<SavedRequestRevision?> FindAsync(Guid requestId,int revision,CancellationToken ct);
    Task TrimAsync(Guid requestId,int keepExisting,CancellationToken ct);
    void Add(SavedRequestRevision revision);
}
public interface IUnitOfWork { Task<int> SaveChangesAsync(CancellationToken ct); }
public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string password, string storedHash);
}
public interface IJwtTokenService { (string token, int expiresInSeconds) CreateToken(User user); }

public interface IRequestEnvironmentRepository
{
    Task<IReadOnlyList<RequestEnvironment>> ListAsync(Guid workspaceId,CancellationToken ct);
    Task<RequestEnvironment?> FindAsync(Guid id,CancellationToken ct);
    void Add(RequestEnvironment environment);
    void Remove(RequestEnvironment environment);
    void AddVariable(RequestEnvironmentVariable variable);
    void RemoveVariable(RequestEnvironmentVariable variable);
}
public interface IEnvironmentValueCipher
{
    string Protect(string clear);
    string Unprotect(string value);
}

public interface IWorkspaceInvitationRepository
{
    Task<IReadOnlyList<WorkspaceInvitation>> ListAsync(Guid workspaceId,CancellationToken ct);
    Task<WorkspaceInvitation?> FindAsync(Guid id,CancellationToken ct);
    Task<WorkspaceInvitation?> FindByTokenHashAsync(string hash,CancellationToken ct);
    Task<bool> HasPendingAsync(Guid workspaceId,string email,DateTimeOffset now,CancellationToken ct);
    Task<int> CountPendingAsync(Guid workspaceId,DateTimeOffset now,CancellationToken ct);
    void Add(WorkspaceInvitation invitation);
}
public interface IWorkspaceInvitationEmailSender
{
    Task SendAsync(string email,string workspaceName,string invitationUrl,CancellationToken ct);
}
