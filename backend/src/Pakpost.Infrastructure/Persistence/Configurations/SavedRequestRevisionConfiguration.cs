using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pakpost.Domain.Entities;
namespace Pakpost.Infrastructure.Persistence.Configurations;
public sealed class SavedRequestRevisionConfiguration:IEntityTypeConfiguration<SavedRequestRevision>
{
    public void Configure(EntityTypeBuilder<SavedRequestRevision> b)
    {
        b.ToTable("saved_request_revisions","collection");
        b.HasKey(x=>x.Id);
        b.Property(x=>x.Action).HasMaxLength(24).IsRequired();
        b.Property(x=>x.EncryptedSnapshot).HasColumnName("encrypted_snapshot").HasColumnType("text").IsRequired();
        b.Property(x=>x.CreatedAt).HasColumnName("created_at");
        b.HasIndex(x=>new{x.RequestId,x.Revision}).IsUnique();
        b.HasOne<SavedRequest>().WithMany().HasForeignKey(x=>x.RequestId).OnDelete(DeleteBehavior.Cascade);
    }
}
