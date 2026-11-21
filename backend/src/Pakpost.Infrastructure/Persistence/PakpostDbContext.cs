using System.Data;
using Microsoft.EntityFrameworkCore;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;
using Pakpost.Infrastructure.Services;

namespace Pakpost.Infrastructure.Persistence;

public sealed partial class PakpostDbContext(
    DbContextOptions<PakpostDbContext> options,
    WorkspaceCryptography? cryptography = null)
    : DbContext(options), IUnitOfWork, ITransactionManager
{
    private readonly WorkspaceCryptography? _cryptography = cryptography;

    public DbSet<User> Users => Set<User>();
    public DbSet<UserSession> UserSessions => Set<UserSession>();
    public DbSet<UserExternalIdentity> UserExternalIdentities => Set<UserExternalIdentity>();
    public DbSet<Workspace> Workspaces => Set<Workspace>();
    public DbSet<WorkspaceEncryptionKey> WorkspaceEncryptionKeys => Set<WorkspaceEncryptionKey>();
    public DbSet<WorkspaceMember> WorkspaceMembers => Set<WorkspaceMember>();
    public DbSet<WorkspaceMemberRole> WorkspaceMemberRoles => Set<WorkspaceMemberRole>();
    public DbSet<WorkspaceInvitation> WorkspaceInvitations => Set<WorkspaceInvitation>();
    public DbSet<PlatformCreatorInvitation> PlatformCreatorInvitations => Set<PlatformCreatorInvitation>();
    public DbSet<Collection> Collections => Set<Collection>();
    public DbSet<CollectionFolder> CollectionFolders => Set<CollectionFolder>();
    public DbSet<SavedRequest> SavedRequests => Set<SavedRequest>();
    public DbSet<SavedRequestRevision> SavedRequestRevisions => Set<SavedRequestRevision>();
    public DbSet<Team> Teams => Set<Team>();
    public DbSet<TeamMember> TeamMembers => Set<TeamMember>();
    public DbSet<RequestEnvironment> RequestEnvironments => Set<RequestEnvironment>();
    public DbSet<RequestEnvironmentVariable> RequestEnvironmentVariables => Set<RequestEnvironmentVariable>();

    public async Task<ITransactionScope> BeginSerializableAsync(CancellationToken cancellationToken)
    {
        var transaction = await Database.BeginTransactionAsync(
            IsolationLevel.Serializable,
            cancellationToken);

        return new EfTransactionScope(transaction);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(PakpostDbContext).Assembly);
    }
}
