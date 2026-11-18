namespace Pakpost.Application.Common.Interfaces;

public interface ITransactionManager
{
    Task<ITransactionScope> BeginSerializableAsync(CancellationToken cancellationToken);
}
