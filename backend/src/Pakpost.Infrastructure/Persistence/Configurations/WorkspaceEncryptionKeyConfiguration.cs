using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pakpost.Domain.Entities;

namespace Pakpost.Infrastructure.Persistence.Configurations;

public sealed class WorkspaceEncryptionKeyConfiguration : IEntityTypeConfiguration<WorkspaceEncryptionKey>
{
    public void Configure(EntityTypeBuilder<WorkspaceEncryptionKey> builder)
    {
        builder.ToTable("workspace_encryption_keys", "organization");
        builder.HasKey(key => key.WorkspaceId);

        builder.Property(key => key.KeyVersion).IsRequired();
        builder.Property(key => key.MasterKeyId).HasMaxLength(100).IsRequired();
        builder.Property(key => key.WrappedKey).HasColumnType("text").IsRequired();

        builder.HasOne<Workspace>()
            .WithOne()
            .HasForeignKey<WorkspaceEncryptionKey>(key => key.WorkspaceId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
