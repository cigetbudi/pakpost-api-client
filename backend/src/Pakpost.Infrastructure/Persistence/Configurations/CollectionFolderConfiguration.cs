using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pakpost.Domain.Entities;

namespace Pakpost.Infrastructure.Persistence.Configurations;
public sealed class CollectionFolderConfiguration : IEntityTypeConfiguration<CollectionFolder>
{
    public void Configure(EntityTypeBuilder<CollectionFolder> b)
    {
        b.ToTable("collection_folders","collection");
        b.HasKey(x=>x.Id);
        b.Property(x=>x.Name).HasMaxLength(120).IsRequired();
        b.Property(x=>x.ParentFolderId).HasColumnName("parent_folder_id");
        b.Property(x=>x.Version).HasColumnName("version").HasDefaultValue(1).IsConcurrencyToken();
        b.HasOne<Collection>().WithMany().HasForeignKey(x=>x.CollectionId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<CollectionFolder>().WithMany().HasForeignKey(x=>x.ParentFolderId).OnDelete(DeleteBehavior.NoAction);
        b.HasIndex(x=>new {x.CollectionId,x.ParentFolderId});
        b.HasIndex(x=>new {x.CollectionId,x.Name}).IsUnique().HasFilter("parent_folder_id IS NULL");
        b.HasIndex(x=>new {x.CollectionId,x.ParentFolderId,x.Name}).IsUnique().HasFilter("parent_folder_id IS NOT NULL");
    }
}
