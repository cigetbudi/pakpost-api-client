using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pakpost.Domain.Entities;
namespace Pakpost.Infrastructure.Persistence.Configurations;
public sealed class SavedRequestConfiguration:IEntityTypeConfiguration<SavedRequest>
{
    public void Configure(EntityTypeBuilder<SavedRequest> b)
    {
        b.ToTable("saved_requests","collection");b.HasKey(x=>x.Id);
        b.Property(x=>x.Revision).HasColumnName("revision").HasDefaultValue(1).IsConcurrencyToken();
        b.Property(x=>x.Name).HasMaxLength(120).IsRequired();
        b.Property(x=>x.Method).HasMaxLength(10).IsRequired();
        b.Property(x=>x.Url).HasMaxLength(2048).IsRequired();
        b.Property(x=>x.HeadersJson).HasColumnType("jsonb").IsRequired();
        b.Property(x=>x.Body).HasColumnType("text").IsRequired();
        b.Property(x=>x.BodyMode).HasMaxLength(20).HasDefaultValue("raw").IsRequired();
        b.Property(x=>x.ContentType).HasMaxLength(150).HasDefaultValue("application/json").IsRequired();
        b.Property(x=>x.FormFieldsJson).HasColumnType("jsonb").HasDefaultValue("[]").IsRequired();
        b.Property(x=>x.PreRequestScript).HasColumnType("text").HasDefaultValue("").IsRequired();
        b.Property(x=>x.PostResponseScript).HasColumnType("text").HasDefaultValue("").IsRequired();
        b.HasOne<Collection>().WithMany().HasForeignKey(x=>x.CollectionId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<CollectionFolder>().WithMany().HasForeignKey(x=>x.FolderId).OnDelete(DeleteBehavior.NoAction);
        b.HasIndex(x=>x.CollectionId);
        b.HasIndex(x=>x.FolderId);
    }
}
