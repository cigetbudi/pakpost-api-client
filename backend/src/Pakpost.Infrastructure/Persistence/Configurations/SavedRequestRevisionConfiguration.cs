using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pakpost.Domain.Entities;

namespace Pakpost.Infrastructure.Persistence.Configurations;

public sealed class SavedRequestRevisionConfiguration : IEntityTypeConfiguration<SavedRequestRevision>
{
    public void Configure(EntityTypeBuilder<SavedRequestRevision> builder)
    {
        builder.ToTable("saved_request_revisions", "collection");
        builder.HasKey(revision => revision.Id);

        builder.Property(revision => revision.Action).HasMaxLength(24).IsRequired();

        builder.Property(revision => revision.EncryptedSnapshot)
            .HasColumnName("encrypted_snapshot")
            .HasColumnType("text")
            .IsRequired();

        builder.Property(revision => revision.CreatedAt).HasColumnName("created_at");

        builder.HasIndex(revision => new { revision.RequestId, revision.Revision }).IsUnique();

        builder.HasOne<SavedRequest>()
            .WithMany()
            .HasForeignKey(revision => revision.RequestId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
