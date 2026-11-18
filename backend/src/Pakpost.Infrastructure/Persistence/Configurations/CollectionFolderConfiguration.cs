using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pakpost.Domain.Entities;

namespace Pakpost.Infrastructure.Persistence.Configurations;

public sealed class CollectionFolderConfiguration : IEntityTypeConfiguration<CollectionFolder>
{
    public void Configure(EntityTypeBuilder<CollectionFolder> builder)
    {
        builder.ToTable("collection_folders", "collection");
        builder.HasKey(folder => folder.Id);
        builder.Property(folder => folder.Name).HasMaxLength(120).IsRequired();
        builder.Property(folder => folder.ParentFolderId).HasColumnName("parent_folder_id");

        builder.Property(folder => folder.Version)
            .HasColumnName("version")
            .HasDefaultValue(1)
            .IsConcurrencyToken();

        builder.HasOne<Collection>()
            .WithMany()
            .HasForeignKey(folder => folder.CollectionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<CollectionFolder>()
            .WithMany()
            .HasForeignKey(folder => folder.ParentFolderId)
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasIndex(folder => new { folder.CollectionId, folder.ParentFolderId });

        builder.HasIndex(folder => new { folder.CollectionId, folder.Name })
            .IsUnique()
            .HasFilter("parent_folder_id IS NULL");

        builder.HasIndex(folder => new
        {
            folder.CollectionId,
            folder.ParentFolderId,
            folder.Name
        })
            .IsUnique()
            .HasFilter("parent_folder_id IS NOT NULL");
    }
}
