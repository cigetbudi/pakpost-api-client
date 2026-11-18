using Pakpost.Domain.Entities;

namespace Pakpost.Application.Common.Interfaces;

public interface IUnitOfWork { Task<int> SaveChangesAsync(CancellationToken ct);
}
